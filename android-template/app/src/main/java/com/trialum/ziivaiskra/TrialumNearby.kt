package com.trialum.ziivaiskra

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
                .setTitle("ТРИАЛУМ · Проверка на пријател")
                .setMessage(
                    "Споредете го кодот на двата телефона:\n\n" +
                    info.authenticationDigits +
                    "\n\nПрифатете само ако кодовите се идентични. Никогаш не прифаќај непознат уред."
                )
                .setPositiveButton("Кодовите се исти") { _, _ ->
                    client.acceptConnection(endpointId, payloadCallback)
                        .addOnFailureListener { notify("error", "Поврзувањето не беше прифатено.") }
                }
                .setNegativeButton("Откажи") { _, _ ->
                    client.rejectConnection(endpointId)
                    stop()
                }
                .setOnCancelListener { client.rejectConnection(endpointId); stop() }
                .show()
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (endpointId != activeEndpoint) return
            if (result.status.statusCode == CommonStatusCodes.SUCCESS) {
                notify("connected", "Безбедна блиска врска.")
                client.stopAdvertising()
                client.stopDiscovery()
                if (mode == "host" && code.matches(hostCode)) {
                    client.sendPayload(endpointId, Payload.fromBytes(hostCode.toByteArray(Charsets.UTF_8)))
                        .addOnSuccessListener { notify("sent", "Поканата е испратена.") }
                        .addOnFailureListener { notify("error", "Не успеа испраќањето.") }
                }
            } else {
                notify("error", "Блиското поврзување не успеа.")
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
            notify("found", "Пронајден е близок TRIALUM уред.")
            client.requestConnection("TRIALUM", endpointId, lifecycle)
                .addOnFailureListener {
                    requested = null
                    notify("error", "Не успеа барањето за поврзување.")
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
        if (!code.matches(invite)) { notify("error", "Невалидна покана."); return }
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
            notify("permission", "Потребна е дозвола за блиски уреди.")
            activity.requestPermissions(missing.toTypedArray(), REQUEST_CODE)
        } else proceed()
    }
    fun onPermissionsResult(requestCode: Int, grants: IntArray) {
        if (requestCode != REQUEST_CODE) return
        if (grants.isNotEmpty() && grants.all { it == PackageManager.PERMISSION_GRANTED }) proceed()
        else { pendingStart = null; notify("error", "Дозволите за блиски уреди се одбиени.") }
    }
    private fun proceed() {
        val target = pendingStart ?: return
        stop()
        pendingStart = null
        mode = target
        if (target == "host") {
            client.startAdvertising("TRIALUM", service, lifecycle,
                AdvertisingOptions.Builder().setStrategy(strategy).build())
                .addOnSuccessListener { notify("hosting", "Се чека близок пријател…") }
                .addOnFailureListener { notify("error", "Не може да се огласи уредот."); stop() }
        } else {
            client.startDiscovery(service, discovery, DiscoveryOptions.Builder().setStrategy(strategy).build())
                .addOnSuccessListener { notify("scanning", "Се бара близок пријател…") }
                .addOnFailureListener { notify("error", "Не може да се пребаруваат блиски уреди."); stop() }
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
