plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.trialum.ziivaiskra"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.trialum.ziivaiskra"
        buildConfigField("Boolean", "BETA_TESTER_TOOLS", "false")
        manifestPlaceholders["trialumInviteScheme"] = "trialum"
        minSdk = 26
        targetSdk = 36
        versionCode = 38
        versionName = "1.0"
        // No social server configured in public/debug APKs until HTTPS endpoint is deployed.
        // Never accept http://, LAN IPs or historical DDNS as the release endpoint.
        val socialApiUrl = (project.findProperty("trialumSocialApiUrl") as? String)
            ?.trim()?.removeSuffix("/") ?: ""
        require(socialApiUrl.isEmpty() ||
            socialApiUrl.matches(Regex("^https://[A-Za-z0-9.-]+(?::443)?$"))) {
            "TRIALUM Social API must use a configured HTTPS hostname"
        }
        resValue("string", "trialum_social_api_url", socialApiUrl)
        // Public Firebase client identifiers, NOT backend service-account secrets.
        // Unset values keep FCM unavailable; no SDK token is requested.
        val fcmAppId = (project.findProperty("trialumFirebaseAppId") as? String)?.trim() ?: ""
        val fcmSenderId = (project.findProperty("trialumFirebaseSenderId") as? String)?.trim() ?: ""
        val fcmProjectId = (project.findProperty("trialumFirebaseProjectId") as? String)?.trim() ?: ""
        val fcmApiKey = (project.findProperty("trialumFirebaseApiKey") as? String)?.trim() ?: ""
        val fcmAll = listOf(fcmAppId,fcmSenderId,fcmProjectId,fcmApiKey)
        require(fcmAll.all { it.isEmpty() } || fcmAll.all { it.isNotEmpty() }) {
            "Firebase client configuration must be entirely supplied or omitted"
        }
        if (fcmAppId.isNotEmpty()) {
            require(fcmAppId.matches(Regex("^1:[0-9]+:android:[0-9a-fA-F]+$")) &&
                fcmAppId.startsWith("1:$fcmSenderId:android:")) {
                "Firebase Release Android App ID and sender ID must belong to the same project"
            }
        }
        resValue("string", "trialum_firebase_app_id", fcmAppId)
        resValue("string", "trialum_firebase_sender_id", fcmSenderId)
        resValue("string", "trialum_firebase_project_id", fcmProjectId)
        resValue("string", "trialum_firebase_api_key", fcmApiKey)
        // Public Play Games Services IDs are supplied by Play Console.
        // With the default "0", PGS stays disabled and local play is unchanged.
        val pgsProjectId = (project.findProperty("trialumPgsProjectId") as? String)
            ?.trim()?.takeIf { it.matches(Regex("[0-9]{6,25}")) } ?: "0"
        resValue("string", "game_services_project_id", pgsProjectId)
        listOf("first_pet", "first_plant", "learned", "advanced", "ecology", "lab6", "dna").forEach { key ->
            val value = (project.findProperty("trialumPgsAchievement_" + key) as? String)
                ?.trim()?.takeIf { it.matches(Regex("[A-Za-z0-9_-]{0,150}")) } ?: ""
            resValue("string", "pgs_achievement_" + key, value)
        }
        listOf("xp", "species").forEach { key ->
            val value = (project.findProperty("trialumPgsLeaderboard_" + key) as? String)
                ?.trim()?.takeIf { it.matches(Regex("[A-Za-z0-9_-]{0,150}")) } ?: ""
            resValue("string", "pgs_leaderboard_" + key, value)
        }
    }
    // Isolated install for LW-A QA. It never replaces the existing debug APK.
    // It uses its own Android UID, WebView storage and Android Keystore scope.
    buildTypes {
        // Internal testing candidate only. Play's internal tester list controls
        // distribution; the normal release build never includes this test panel.
        create("internalBeta") {
            initWith(getByName("release"))
            isDebuggable = false
            buildConfigField("Boolean", "BETA_TESTER_TOOLS", "true")
            manifestPlaceholders["trialumInviteScheme"] = "trialum"
        }
    }
    buildTypes {
        create("lwa") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".lwa"
            versionNameSuffix = "-lwa"
            isDebuggable = true
            manifestPlaceholders["trialumInviteScheme"] = "trialum-lwa"
        }
    }
    // 1.6-LW QA must never replace the normal app or the historical .lwa test app.
    // Independent WebView data, backup vault, social identity and invite scheme.
    buildTypes {
        create("lw16") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".lw16"
            versionNameSuffix = "-test"
            isDebuggable = true
            manifestPlaceholders["trialumInviteScheme"] = "trialum-lw16"
        }
    }
    // Owner-controlled signing for the persistent QA packages. No keystores or
    // passwords are configured here. The official Release package remains locally
    // signed; only the isolated one-time .pgstest candidate uses a runner-ephemeral key.
    buildTypes {
        create("signqa") {
            initWith(getByName("release"))
            applicationIdSuffix = ".signqa"
            versionNameSuffix = "-signqa"
            isDebuggable = false
            manifestPlaceholders["trialumInviteScheme"] = "trialum-signqa"
            // Different application IDs MUST have different registered Firebase Android App IDs.
            // Previously the QA package inherited the Release ID, silently building broken FCM.
            val qaAppId = (project.findProperty("trialumFirebaseAppIdSignqa") as? String)?.trim().orEmpty()
            val releaseAppId = (project.findProperty("trialumFirebaseAppId") as? String)?.trim().orEmpty()
            val fcmSender = (project.findProperty("trialumFirebaseSenderId") as? String)?.trim().orEmpty()
            if (releaseAppId.isNotEmpty()) {
                require(qaAppId.matches(Regex("^1:[0-9]+:android:[0-9a-fA-F]+$")) &&
                    qaAppId != releaseAppId && qaAppId.startsWith("1:$fcmSender:android:")) {
                    "Firebase SignQA mismatch: register com.trialum.ziivaiskra.signqa " +
                        "in the same Firebase project and set TRIALUM_FIREBASE_APP_ID_SIGNQA"
                }
                resValue("string", "trialum_firebase_app_id", qaAppId)
            }
        }
    }
    // Owner-signed debug/testing companion to the existing Signing QA app.
    // Different package/UID => independent account, friends and local world
    // on the SAME Galaxy A55. Same permanent trialum-qa signer as .signqa,
    // applied by the protected GitHub Actions job (never runner debug signing).
    // Deliberately do NOT reuse legacy .lwa/.lw16 or main debug package IDs.
    buildTypes {
        create("signdebug") {
            initWith(getByName("release"))
            applicationIdSuffix = ".signdebug"
            versionNameSuffix = "-signdebug"
            isDebuggable = true
            manifestPlaceholders["trialumInviteScheme"] = "trialum-signdebug"
            val friendsDebugAppId = (project.findProperty("trialumFirebaseAppIdSigndebug") as? String)?.trim().orEmpty()
            val releaseAppId = (project.findProperty("trialumFirebaseAppId") as? String)?.trim().orEmpty()
            val signqaAppId = (project.findProperty("trialumFirebaseAppIdSignqa") as? String)?.trim().orEmpty()
            val fcmSender = (project.findProperty("trialumFirebaseSenderId") as? String)?.trim().orEmpty()
            if (releaseAppId.isNotEmpty()) {
                require(friendsDebugAppId.matches(Regex("^1:[0-9]+:android:[0-9a-fA-F]+$")) &&
                    friendsDebugAppId != releaseAppId && friendsDebugAppId != signqaAppId &&
                    friendsDebugAppId.startsWith("1:$fcmSender:android:")) {
                    "Firebase Friends Debug mismatch: register com.trialum.ziivaiskra.signdebug " +
                        "in the same Firebase project and set TRIALUM_FIREBASE_APP_ID_SIGNDEBUG"
                }
                resValue("string", "trialum_firebase_app_id", friendsDebugAppId)
            }
        }
    }
    // One-time isolated Play Games diagnosis install. Its package ID is distinct
    // so it cannot replace the owner's installed app or touch its WebView data.
    // It requires its own Firebase Android app ID and one-time PGS OAuth client.
    if (!(project.findProperty("trialumFirebaseAppIdPgstest") as? String).isNullOrBlank()) {
        buildTypes {
            create("pgstest") {
                initWith(getByName("release"))
                applicationIdSuffix = ".pgstest"
                versionNameSuffix = "-pgstest"
                isDebuggable = true
                manifestPlaceholders["trialumInviteScheme"] = "trialum-pgstest"
                val pgsTestAppId = (project.findProperty("trialumFirebaseAppIdPgstest") as? String)?.trim().orEmpty()
                val releaseAppId = (project.findProperty("trialumFirebaseAppId") as? String)?.trim().orEmpty()
                val signqaAppId = (project.findProperty("trialumFirebaseAppIdSignqa") as? String)?.trim().orEmpty()
                val signdebugAppId = (project.findProperty("trialumFirebaseAppIdSigndebug") as? String)?.trim().orEmpty()
                val fcmSender = (project.findProperty("trialumFirebaseSenderId") as? String)?.trim().orEmpty()
                if (releaseAppId.isNotEmpty()) {
                require(pgsTestAppId.matches(Regex("^1:[0-9]+:android:[0-9a-fA-F]+$")) &&
                    pgsTestAppId != releaseAppId && pgsTestAppId != signqaAppId &&
                    pgsTestAppId != signdebugAppId && pgsTestAppId.startsWith("1:$fcmSender:android:")) {
                    "Firebase PGS test mismatch: register com.trialum.ziivaiskra.pgstest " +
                        "in the same Firebase project and set TRIALUM_FIREBASE_APP_ID_PGSTEST"
                }
                resValue("string", "trialum_firebase_app_id", pgsTestAppId)
                }
            }
        }
    }
    // One-time GP-01 gameplay test install. Separate package and local data so
    // the disposable GitHub runner signature cannot replace Trialum or QA apps.
    // PGS and FCM are intentionally disabled in this random-signed, offline-focused test APK.
    buildTypes {
        create("gp01test") {
            initWith(getByName("release"))
            applicationIdSuffix = ".gp01test"
            versionNameSuffix = "-gp01test"
            isDebuggable = true
            manifestPlaceholders["trialumInviteScheme"] = "trialum-gp01test"
            resValue("string", "game_services_project_id", "0")
            resValue("string", "trialum_firebase_app_id", "")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
}
dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("dev.ffmpegkit-maintained:llama-android:0.1.1")
    implementation("com.google.android.gms:play-services-games-v2:22.1.0")
    implementation("com.google.android.play:age-signals:0.0.4")
    implementation("com.google.android.gms:play-services-nearby:19.3.0")
    implementation("com.google.firebase:firebase-messaging:25.1.3")
}
// Bundle the same web game in the APK. No remote hosting or duplicated sources needed.
val syncWebAssets by tasks.registering(Copy::class) {
    from(projectDir.parentFile.parentFile) {
        include("index.html", "manifest.webmanifest", "sw.js", "assets/**", "js/**", "locales/**", "vendor/**")
    }
    into(layout.projectDirectory.dir("src/main/assets/web"))
}
tasks.named("preBuild") { dependsOn(syncWebAssets) }
