// 앱 안에 직접 만든 플러그인(BaetnilTrack)을 캐퍼시터에 등록하는 곳.
// 캐퍼시터 공식 문서 「Custom Native iOS Code」 가 가리키는 방법 그대로다 —
// CAPBridgeViewController 를 이어받아 capacitorDidLoad 에서 registerPluginInstance 한다.
// https://capacitorjs.com/docs/ios/custom-code
//
// ★★★ 5.19 → 5.20 — 아이폰: 옆으로 쓸어 뒤로 가기
//
//   사장님 지적: 「항해일지 옆으로 쓸면 뒤로가기 되야하는데 안된다」
//   5.18 까지 아이폰 앱에는 쓸어 뒤로 가기가 아예 없었다(안드로이드는 폰이 「뒤로」 를 보내 준다).
//   5.19 는 다른 앱 조사 없이 왼쪽 끝 쓸기만 만들었다(사장님 격노).
//   5.20 은 조사한 대로 애플 방식에 맞춘다 — 「claude/뱃일-아이폰-뒤로가기-진동-다른앱조사.md」
//
//   ① 어디서 시작하나 — iOS 26 부터 아이폰 앱은 화면 어디서든 왼→오른쪽으로 밀면 뒤로 간다
//      (UINavigationController.interactiveContentPopGestureRecognizer: 「entire content area」).
//      그래서 왼쪽 끝이 아니라 화면 전체에서 오른쪽으로 미는 것을 받는다.
//   ② 옆으로 스스로 움직이는 칸(지도·도면·달력·가로로 밀리는 줄) 위에서 시작하면 그 칸이 먼저다.
//      iOS 26 가운데 쓸기가 구글 지도 옆 밀기와 부딪혔다는 개발자 보고(애플 포럼 803771)가 있다.
//      어느 칸이 그런 칸인지는 웹 쪽(window.__iosBack.can(x, y))이 손가락 자리를 보고 정한다.
//      왼쪽 끝(24pt)에서 시작한 쓸기는 어디서든 뒤로 간다 — 원래 아이폰의 왼쪽 끝 쓸기 그대로.
//   ③ 밀 때 밑에 이전 화면이 드러난다. 지금 화면(웹뷰)이 손가락을 따라 오른쪽으로 밀려나고,
//      그 밑에 되돌아갈 화면의 모습을 깐다. 그 모습은 손가락이 화면에 닿을 때마다 찍어 둔다
//      (화면마다 열쇠 navKey 로 — 웹 쪽이 준다). 놓으면 진짜 화면으로 바뀐다.
//      찍어 둔 것이 없으면 바탕색만 깐다.
//   ★ 무엇을 물릴지는 안드로이드 뒤로가기와 같은 문(navDoBack)이 정한다.
//   ★ 오늘 첫 자리(물릴 것 없음)와 도면에 그리는 중에는 쓸기가 시작되지 않는다.
import UIKit
import WebKit
import Capacitor

class MainViewController: CAPBridgeViewController, UIGestureRecognizerDelegate {
    private var pan: UIPanGestureRecognizer?
    private var answered = false         // 이번 손가락에 대해 웹 쪽이 대답했나
    private var canBack = false          // 이번 손가락 자리에서 뒤로 갈 수 있나
    private var backKey = ""             // 되돌아갈 화면의 열쇠
    private var touchSeq = 0
    private var busy = false             // 밀려나는 그림이 도는 중
    private var pageColor: UIColor?      // 사진이 없을 때 깔 바탕색 (앱 바탕과 같게)
    private var under: UIView?           // 밑에 까는 이전 화면
    private var shade: UIView?           // 이전 화면 위 옅은 그늘

    // 화면 열쇠 → 그 화면 모습(JPEG). 최근 것 몇 장만 둔다.
    private var snaps: [String: Data] = [:]
    private var snapOrder: [String] = []
    private var snapAt: [String: CFTimeInterval] = [:]
    private let snapMax = 12
    private var snapping = false

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BaetnilTrack())
    }

    override open func viewDidLoad() {
        super.viewDidLoad()
        guard let wv = webView else { return }
        let g = UIPanGestureRecognizer(target: self, action: #selector(swipe(_:)))
        g.delegate = self
        g.maximumNumberOfTouches = 1
        wv.addGestureRecognizer(g)
        pan = g
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        snaps.removeAll(); snapOrder.removeAll(); snapAt.removeAll()
    }

    // ── 손가락이 닿는 순간: 이 자리에서 뒤로 갈 수 있는지 묻고, 지금 화면 모습을 찍어 둔다
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard g === pan, let wv = webView, !busy else { return true }
        let p = touch.location(in: wv)
        let ins = wv.scrollView.adjustedContentInset
        let x = Double(p.x - ins.left), y = Double(p.y - ins.top)
        touchSeq += 1
        let seq = touchSeq
        answered = false
        canBack = false
        let js = "window.__iosBack?JSON.stringify(window.__iosBack.can(\(x),\(y))):'{}'"
        wv.evaluateJavaScript(js) { [weak self] r, _ in
            guard let self = self, seq == self.touchSeq else { return }
            var ok = false
            var key = ""
            if let s = r as? String, let d = s.data(using: .utf8),
               let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] {
                ok = (o["ok"] as? Bool) ?? false
                key = (o["back"] as? String) ?? ""
                if let b = o["bg"] as? String, let c = MainViewController.cssColor(b) { self.pageColor = c }
            }
            self.canBack = ok
            self.backKey = key
            self.answered = true
        }
        snapNow(wv)
        return true
    }

    func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
        guard g === pan, let p = pan, let wv = webView else { return true }
        if busy || !answered || !canBack { return false }
        let v = p.velocity(in: wv)
        return v.x > 0 && abs(v.x) > abs(v.y) * 1.2      // 오른쪽으로, 옆으로 민 것만
    }

    // 화면 스크롤(웹 화면·가로로 밀리는 줄)은 쓸기가 아닌 것이 판가름 난 뒤에 움직인다.
    // 위아래로 미는 손가락은 쓸기가 곧바로 포기하므로 스크롤이 늦어지지 않는다.
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool {
        return g === pan && other is UIPanGestureRecognizer && other.view is UIScrollView
    }

    // ── 지금 화면 모습을 열쇠와 함께 찍어 둔다
    private func snapNow(_ wv: WKWebView) {
        if snapping { return }
        snapping = true
        wv.evaluateJavaScript("window.__iosBack?window.__iosBack.key():''") { [weak self] r, _ in
            guard let self = self, let wv = self.webView else { return }
            let key = (r as? String) ?? ""
            let now = CACurrentMediaTime()
            if key.isEmpty || now - (self.snapAt[key] ?? 0) < 0.5 { self.snapping = false; return }
            let cfg = WKSnapshotConfiguration()
            cfg.afterScreenUpdates = false
            wv.takeSnapshot(with: cfg) { img, _ in
                guard let img = img else { self.snapping = false; return }
                // 찍는 동안 화면이 바뀌었으면 어느 화면인지 모르므로 버린다
                wv.evaluateJavaScript("window.__iosBack?window.__iosBack.key():''") { r2, _ in
                    guard (r2 as? String) == key else { self.snapping = false; return }
                    DispatchQueue.global(qos: .utility).async {
                        let data = img.jpegData(compressionQuality: 0.72)
                        DispatchQueue.main.async {
                            self.snapping = false
                            guard let data = data else { return }
                            self.snaps[key] = data
                            self.snapAt[key] = now
                            self.snapOrder.removeAll { $0 == key }
                            self.snapOrder.append(key)
                            while self.snapOrder.count > self.snapMax {
                                let old = self.snapOrder.removeFirst()
                                self.snaps[old] = nil
                                self.snapAt[old] = nil
                            }
                        }
                    }
                }
            }
        }
    }

    // ── 쓸기
    @objc private func swipe(_ g: UIPanGestureRecognizer) {
        guard let wv = webView else { return }
        let host = wv.superview ?? wv
        let w = max(wv.bounds.width, 1)
        let tx = max(0, g.translation(in: host).x)
        switch g.state {
        case .began:
            underOn(wv)
            slide(tx, w)
        case .changed:
            slide(tx, w)
        case .ended, .cancelled, .failed:
            let vx = g.velocity(in: host).x
            let go = g.state == .ended && (tx > w * 0.4 || (vx > 500 && tx > 16))
            go ? commit(w) : cancel(w)
        default:
            break
        }
    }

    private func underOn(_ wv: WKWebView) {
        underOff()
        guard let sup = wv.superview else { return }
        let u = UIView(frame: wv.frame)
        u.backgroundColor = pageColor ?? wv.backgroundColor ?? .systemBackground
        u.isUserInteractionEnabled = false
        if let d = snaps[backKey], let img = UIImage(data: d) {
            let iv = UIImageView(image: img)
            iv.frame = u.bounds
            iv.contentMode = .scaleAspectFill
            iv.clipsToBounds = true
            u.addSubview(iv)
        }
        let s = UIView(frame: u.bounds)
        s.backgroundColor = .black
        s.alpha = 0.12
        u.addSubview(s)
        sup.insertSubview(u, belowSubview: wv)
        under = u
        shade = s
        wv.layer.shadowColor = UIColor.black.cgColor
        wv.layer.shadowOpacity = 0.25
        wv.layer.shadowRadius = 8
        wv.layer.shadowOffset = CGSize(width: -3, height: 0)
        wv.layer.shadowPath = UIBezierPath(rect: wv.bounds).cgPath
    }

    // 지금 화면은 손가락만큼, 밑의 이전 화면은 왼쪽에서 조금 늦게 따라 들어온다
    private func slide(_ tx: CGFloat, _ w: CGFloat) {
        guard let wv = webView else { return }
        let p = min(max(tx / w, 0), 1)
        wv.transform = CGAffineTransform(translationX: tx, y: 0)
        under?.transform = CGAffineTransform(translationX: -w * 0.3 * (1 - p), y: 0)
        shade?.alpha = 0.12 * (1 - p)
    }

    private func underOff() {
        under?.removeFromSuperview()
        under = nil
        shade = nil
        if let wv = webView {
            wv.layer.shadowOpacity = 0
            wv.layer.shadowPath = nil
        }
    }

    private func cancel(_ w: CGFloat) {
        busy = true
        UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseOut], animations: {
            self.slide(0, w)
        }, completion: { _ in
            self.webView?.transform = .identity
            self.underOff()
            self.busy = false
        })
    }

    private func commit(_ w: CGFloat) {
        busy = true
        UIView.animate(withDuration: 0.24, delay: 0, options: [.curveEaseOut], animations: {
            self.slide(w, w)
        }, completion: { _ in
            guard let wv = self.webView else { self.underOff(); self.busy = false; return }
            // 한 걸음 물리고, 웹 화면이 물린 자리를 두 번 그릴 때까지 기다린다
            let body = "const ok = window.__iosBack ? window.__iosBack.go() : false;"
                + "await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));"
                + "return ok;"
            wv.callAsyncJavaScript(body, arguments: [:], in: nil, in: .page) { res in
                var ok = false
                if case .success(let v) = res { ok = (v as? Bool) ?? ((v as? NSNumber)?.boolValue ?? false) }
                if !ok {
                    // 물린 것이 없으면(그 사이 화면이 바뀌었으면) 제자리로 돌린다
                    self.cancel(w)
                    return
                }
                // 진짜 화면을 제자리에 두고 살짝 겹쳐 바꾼다 (찍어 둔 모습이 조금 옛것이어도 튀지 않게)
                wv.alpha = 0
                wv.transform = .identity
                wv.layer.shadowOpacity = 0
                UIView.animate(withDuration: 0.14, animations: {
                    wv.alpha = 1
                }, completion: { _ in
                    self.underOff()
                    self.busy = false
                })
            }
        })
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
