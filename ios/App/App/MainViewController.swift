// 앱 안에 직접 만든 플러그인(BaetnilTrack)을 캐퍼시터에 등록하는 곳.
// 캐퍼시터 공식 문서 「Custom Native iOS Code」 가 가리키는 방법 그대로다 —
// CAPBridgeViewController 를 이어받아 capacitorDidLoad 에서 registerPluginInstance 한다.
// https://capacitorjs.com/docs/ios/custom-code
import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BaetnilTrack())
    }
}
