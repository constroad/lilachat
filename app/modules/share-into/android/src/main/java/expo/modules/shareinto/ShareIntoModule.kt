package expo.modules.shareinto

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** What another app shared into Lilachat (José, 02/11/2026), for JS to take once. */
class ShareIntoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareInto")
    Events("onShare")

    OnCreate { ShareBridge.listener = { sendEvent("onShare", mapOf<String, Any?>()) } }
    OnDestroy { ShareBridge.listener = null }

    // The event only says there is one: JS takes it here, so a share that arrived before JS listened is not lost.
    Function("takePending") { ShareBridge.take() }
  }
}

/** The last share, until JS takes it. */
object ShareBridge {
  @Volatile var listener: (() -> Unit)? = null
  private var pending: Map<String, Any?>? = null

  @Synchronized fun deliver(shared: Map<String, Any?>) {
    pending = shared
    listener?.invoke()
  }

  @Synchronized fun take(): Map<String, Any?>? = pending.also { pending = null }
}
