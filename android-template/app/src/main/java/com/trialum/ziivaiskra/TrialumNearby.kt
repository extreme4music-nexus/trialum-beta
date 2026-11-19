package com.trialum.ziivaiskra

    private fun text(macedonian: String, english: String): String =
        TrialumNativeText.get(activity, macedonian, english)

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.pm.PackageManager
import android.os.Build
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import org.json.JSONObject

/**
 * Explicit opt-in Nearby Connections pairing transport, NOT a replacement for
 * authenticated server consent. Both phones must compare digits and approve.
 * Transfers only the already-created 15-minute invite token; no personal data.
 * Nearby discovery must be stopped when the app is backgrounded.
 */
internal class TrialumNearby(
    private val activity: Activity,
    private val dispatch: (JSONObject) -> Unit
) {
    private val client by lazy { Nearby.getConnectionsClient(activity) }
    private val service = activity.packageName + ".friends"
    private val code = Regex("^[A-Za-z0-9_-]{43}$")
    private val strategy = Strategy.P2P_POINT_TO_POINT
    private var hostCode: String = ""
    private var mode = ""
    private var activeEndpoint: String? = null
    private var requested: String? = null
    private var pendingStart: String? = null

    private fun notify(kind: String, message: String = "") {
        dispatch(JSONObject().put("kind", kind).put("message", message))
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (endpointId != activeEndpoint || mode != "scan") return
            val bytes = payload.asBytes() ?: return
            if (bytes.size > 80) return
            val invite = String(bytes, Charsets.UTF_8)
            if (code.matches(invite)) {
                notify("invite", invite)
                stop()
            }
        }
        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {}
    }

    private val lifecycle = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            if (mode.isEmpty() || (activeEndpoint != null && activeEndpoint != endpointId)) {
                client.rejectConnection(endpointId)
                return
            }
            activeEndpoint = endpointId
            // Authenticating the displayed digits on BOTH phones is mandatory.
            AlertDialog.Builder(activity)
                .setTitle("TRIALUM · Friend verification")
                .setMessage(
                    text("Споредете го кодот на двата телефона:\n\n", "Compare the code on both phones:\n\n") +
                    info.authenticationDigits +
                    text("\n\nПрифатете само ако кодовите се идентични. Никогаш не прифаќај непознат уред.",
                        "\n\nAccept only if the codes match exactly. Never accept an unknown device.")
                )
                .setPositiveButton(text("Кодовите се исти", "The codes match")) { _, _ ->
                    client.acceptConnection(endpointId, payloadCallback)
                        .addOnFailureListener { notify("error", text("Поврзувањето не беше прифатено.", "The connection was not accepted.")) }
                }
                .setNegativeButton(text("Откажи", "Cancel")) { _, _ ->
                    client.rejectConnection(endpointId)
                    stop()
                }
                .setOnCancelListener { client.rejectConnection(endpointId); stop() }
                .show()
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (endpointId != activeEndpoint) return
            if (result.status.statusCode == CommonStatusCodes.SUCCESS) {
                notify("connected", text("Безбедна блиска врска.", "Secure nearby connection established."))
                client.stopAdvertising()
                client.stopDiscovery()
                if (mode == "host" && code.matches(hostCode)) {
                    client.sendPayload(endpointId, Payload.fromBytes(hostCode.toByteArray(Charsets.UTF_8)))
                        .addOnSuccessListener { notify("sent", text("Поканата е испратена.", "Invitation sent.")) }
                        .addOnFailureListener { notify("error", text("Не успеа испраќањето.", "Could not send the invitation.")) }
                }
            } else {
                notify("error", text("Блиското поврзување не успеа.", "Nearby connection failed."))
                stop()
            }
        }
        override fun onDisconnected(endpointId: String) { stop() }
    }

    private val discovery = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            if (mode != "scan" || requested != null) return
            requested = endpointId
            client.stopDiscovery()
            notify("found", text("Пронајден е близок TRIALUM уред.", "Nearby TRIALUM device found."))
            client.requestConnection("TRIALUM", endpointId, lifecycle)
                .addOnFailureListener {
                    requested = null
                    notify("error", text("Не успеа барањето за поврзување.", "Could not request a connection."))
                    stop()
                }
        }
        override fun onEndpointLost(endpointId: String) {}
    }

    private fun permissions(): Array<String> = when {
        Build.VERSION.SDK_INT >= 33 -> arrayOf(
            Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.NEARBY_WIFI_DEVICES
        )
        Build.VERSION.SDK_INT >= 31 -> arrayOf(
            Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
        Build.VERSION.SDK_INT >= 29 -> arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        else -> arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION)
    }
    fun startHosting(invite: String) {
        if (!code.matches(invite)) { notify("error", text("Невалидна покана.", "Invalid invitation.")); return }
        pendingStart = "host"
        hostCode = invite
        requirePermissions()
    }
    fun startScanning() {
        pendingStart = "scan"
        requirePermissions()
    }
    private fun requirePermissions() {
        val missing = permissions().filter {
            activity.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            notify("permission", text("Потребна е дозвола за блиски уреди.", "Nearby devices permission is required."))
            activity.requestPermissions(missing.toTypedArray(), REQUEST_CODE)
        } else proceed()
    }
    fun onPermissionsResult(requestCode: Int, grants: IntArray) {
        if (requestCode != REQUEST_CODE) return
        if (grants.isNotEmpty() && grants.all { it == PackageManager.PERMISSION_GRANTED }) proceed()
        else { pendingStart = null; notify("error", text("Дозволите за блиски уреди се одбиени.", "Nearby devices permission was denied.")) }
    }
    private fun proceed() {
        val target = pendingStart ?: return
        stop()
        pendingStart = null
        mode = target
        if (target == "host") {
            client.startAdvertising("TRIALUM", service, lifecycle,
                AdvertisingOptions.Builder().setStrategy(strategy).build())
                .addOnSuccessListener { notify("hosting", text("Се чека близок пријател…", "Waiting for a nearby friend…")) }
                .addOnFailureListener { notify("error", text("Не може да се огласи уредот.", "Could not make this device discoverable.")); stop() }
        } else {
            client.startDiscovery(service, discovery, DiscoveryOptions.Builder().setStrategy(strategy).build())
                .addOnSuccessListener { notify("scanning", text("Се бара близок пријател…", "Searching for a nearby friend…")) }
                .addOnFailureListener { notify("error", text("Не може да се пребаруваат блиски уреди.", "Could not search for nearby devices.")); stop() }
        }
    }
    fun stop() {
        client.stopAdvertising()
        client.stopDiscovery()
        activeEndpoint?.let { client.disconnectFromEndpoint(it) }
        mode = ""
        activeEndpoint = null
        requested = null
        pendingStart = null
        hostCode = ""
    }
    companion object { const val REQUEST_CODE = 1566 }
}
