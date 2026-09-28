// 앱 안에 직접 만든 플러그인(BaetnilTrack)을 캐퍼시터에 등록하는 곳.
// 캐퍼시터 공식 문서 「Custom Native iOS Code」 가 가리키는 방법 그대로다 —
// CAPBridgeViewController 를 이어받아 capacitorDidLoad 에서 registerPluginInstance 한다.
// https://capacitorjs.com/docs/ios/custom-code
//
// ★★★ 5.19 — 아이폰: 왼쪽 끝에서 오른쪽으로 쓸어 뒤로 가기
//
//   사장님 지적: 「항해일지 옆으로 쓸면 뒤로가기 되야하는데 안된다」
//   까닭 — 아이폰 앱에는 이것이 **아예 없었다.** 어느 화면에서도 안 됐다.
//   안드로이드는 폰이 「뒤로」 를 앱에 보내 주고(backButton), 앱이 그것을 받아 한 걸음 물린다.
//   아이폰은 그런 단추가 없고, 쓸어 넘기기는 앱이 스스로 붙여야 한다. 그것을 안 붙였다.
//
//   ★ 어떻게 하나 — 안드로이드 뒤로가기와 **같은 문(navDoBack)** 을 쓴다.
//     웹뷰의 쓸어 넘기기(allowsBackForwardNavigationGestures)는 브라우저 방문 기록을 따라가는데,
//     뱃일의 방문 기록은 화면을 [닫기] 로 닫아도 줄지 않아서 앱의 뒤로가기와 어긋난다.
//     (오늘 화면에서 쓸면 옛 화면 그림이 지나갔다가 제자리로 오는 헛 동작이 난다.)
//     그래서 쓸기는 여기서 직접 받고, 무엇을 물릴지는 웹 쪽(window.__iosBack)이 정한다.
//
//   ★ 보이는 모양 — 아이폰 앱처럼 지금 화면이 손가락을 따라 오른쪽으로 밀려난다.
//     40% 넘게 밀거나 빠르게 튕기면 한 걸음 물리고, 덜 밀고 놓으면 제자리로 돌아온다.
//   ★ 물릴 것이 없으면(오늘 화면 첫 자리) 쓸기가 아예 시작되지 않는다 — 가로로 밀리는 칸을 막지 않게.
//   ★ 도면에 그리는 중에는 끈다 — 왼쪽 끝에서 선을 긋다가 뒤로 가 버리지 않게(웹 쪽이 막는다).
import UIKit
import WebKit
import Capacitor

class MainViewController: CAPBridgeViewController, UIGestureRecognizerDelegate {
    private var edgePan: UIScreenEdgePanGestureRecognizer?
    private var canBack = false          // 웹 쪽이 「물릴 것이 있다」 고 한 마지막 대답
    private var asking = false
    private var busy = false             // 밀려나는 그림이 도는 중
    private var pageColor: UIColor?      // 밀린 화면 뒤에 깔 바탕색 (앱 바탕과 같게)
    private var cover: UIView?           // 지금 화면의 사진 — 손가락을 따라 밀린다
    private var under: UIView?           // 사진 뒤 바탕
    private var shade: UIView?           // 바탕 위 옅은 그늘

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BaetnilTrack())
    }

    override open func viewDidLoad() {
        super.viewDidLoad()
        guard let wv = webView else { return }
        let g = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(edgeSwipe(_:)))
        g.edges = .left
        g.delegate = self
        wv.addGestureRecognizer(g)
        edgePan = g
    }

    // ── 웹 쪽에 묻는다: 지금 물릴 것이 있나, 바탕색은 무엇인가
    private func askWeb() {
        guard !asking, let wv = webView else { return }
        asking = true
        wv.evaluateJavaScript("window.__iosBack?JSON.stringify(window.__iosBack.can()):'{}'") { [weak self] r, _ in
            guard let self = self else { return }
            self.asking = false
            var ok = false
            if let s = r as? String, let d = s.data(using: .utf8),
               let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] {
                ok = (o["ok"] as? Bool) ?? false
                if let b = o["bg"] as? String, let c = MainViewController.cssColor(b) { self.pageColor = c }
            }
            self.canBack = ok
        }
    }

    // 손가락이 왼쪽 끝에 닿는 순간 물어 둔다 — 쓸기로 알아보기(손가락이 10pt 남짓 움직인 뒤)보다 대답이 먼저 온다.
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        if g === edgePan, let wv = webView, touch.location(in: wv).x <= 44 { askWeb() }
        return true
    }

    func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
        if g === edgePan { return canBack && !busy }
        return true
    }

    // 화면 스크롤(위아래로 미는 것)은 왼쪽 끝 쓸기가 아닌 것이 판가름 난 뒤에 움직인다.
    // 왼쪽 끝에서 시작하지 않은 손가락은 쓸기가 곧바로 포기하므로 스크롤이 늦어지지 않는다.
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool {
        return g === edgePan && other is UIPanGestureRecognizer && !(other is UIScreenEdgePanGestureRecognizer)
    }

    @objc private func edgeSwipe(_ g: UIScreenEdgePanGestureRecognizer) {
        guard let wv = webView else { return }
        let w = max(wv.bounds.width, 1)
        let tx = max(0, g.translation(in: wv).x)
        switch g.state {
        case .began:
            coverOn(wv)
            coverMove(tx, w)
        case .changed:
            coverMove(tx, w)
        case .ended, .cancelled, .failed:
            let vx = g.velocity(in: wv).x
            let go = g.state == .ended && (tx > w * 0.4 || (vx > 500 && tx > 16))
            finish(go, w)
        default:
            break
        }
    }

    private func coverOn(_ wv: WKWebView) {
        coverOff()
        let b = wv.bounds
        let u = UIView(frame: b)
        u.backgroundColor = pageColor ?? wv.backgroundColor ?? .systemBackground
        u.isUserInteractionEnabled = false
        let s = UIView(frame: u.bounds)
        s.backgroundColor = .black
        s.alpha = 0.18
        u.addSubview(s)
        wv.addSubview(u)
        under = u
        shade = s
        if let snap = wv.snapshotView(afterScreenUpdates: false) {
            snap.frame = b
            snap.isUserInteractionEnabled = false
            snap.layer.shadowColor = UIColor.black.cgColor
            snap.layer.shadowOpacity = 0.28
            snap.layer.shadowRadius = 8
            snap.layer.shadowOffset = CGSize(width: -3, height: 0)
            snap.layer.shadowPath = UIBezierPath(rect: CGRect(origin: .zero, size: b.size)).cgPath
            wv.addSubview(snap)
            cover = snap
        } else {
            // 사진을 못 찍으면 그림 없이 물리기만 한다 (바탕도 걷는다 — 빈 화면이 손가락을 가리지 않게)
            u.removeFromSuperview()
            under = nil
            shade = nil
        }
    }

    private func coverMove(_ tx: CGFloat, _ w: CGFloat) {
        cover?.frame.origin.x = tx
        shade?.alpha = 0.18 * (1 - min(tx / w, 1))
    }

    private func coverOff() {
        cover?.removeFromSuperview()
        under?.removeFromSuperview()
        cover = nil
        under = nil
        shade = nil
    }

    private func snapBack(_ w: CGFloat) {
        UIView.animate(withDuration: 0.2, delay: 0, options: [.curveEaseOut], animations: {
            self.coverMove(0, w)
        }, completion: { _ in
            self.coverOff()
            self.busy = false
        })
    }

    private func finish(_ go: Bool, _ w: CGFloat) {
        busy = true
        guard go, let wv = webView else { snapBack(w); return }
        wv.evaluateJavaScript("window.__iosBack?String(window.__iosBack.go()):'false'") { [weak self] r, _ in
            guard let self = self else { return }
            // 물린 것이 없으면(그 사이에 화면이 바뀌었으면) 제자리로 돌린다 — 헛 동작을 보이지 않는다
            guard (r as? String) == "true" else { self.snapBack(w); return }
            self.canBack = false
            self.askWeb()
            UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseOut], animations: {
                self.coverMove(w, w)
            }, completion: { _ in
                // 웹 화면이 물린 자리를 그릴 틈을 주고 바탕을 걷는다
                UIView.animate(withDuration: 0.14, delay: 0.02, options: [], animations: {
                    self.under?.alpha = 0
                }, completion: { _ in
                    self.coverOff()
                    self.busy = false
                })
            })
        }
    }

    // "rgb(14, 22, 32)" · "rgba(14, 22, 32, 0.5)" → UIColor. 투명이면 nil.
    static func cssColor(_ s: String) -> UIColor? {
        let n = s.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted)
            .filter { !$0.isEmpty }.compactMap { Double($0) }
        guard n.count >= 3 else { return nil }
        let a = n.count >= 4 ? n[3] : 1
        if a < 0.5 { return nil }
        return UIColor(red: CGFloat(n[0] / 255), green: CGFloat(n[1] / 255), blue: CGFloat(n[2] / 255), alpha: 1)
    }
}
