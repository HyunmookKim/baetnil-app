// 뱃일 — 아이폰 항적 쌓아 두기 (5.6, 2026-09-21)
//
// ★ 왜 있나
//   안드로이드에는 화면이 꺼진 동안 점을 파일에 쌓아 두는 네이티브 서비스(BaetnilTrackService)가 있다.
//   아이폰에는 없었다. 캐퍼시터 공식 문서·플러그인 소스를 확인한 것 —
//   · @capacitor-community/background-geolocation 은 iOS 에서 점을 받자마자 JS 로 넘길 뿐
//     기기 안에 쌓아 두지 않는다 (Plugin.swift 의 call.resolve).
//   · 운영체제가 웹뷰를 멈추면 JS 가 돌지 않는다. 그 사이 온 점을 받을 곳이 없다.
//   · 애플 문서: 백그라운드 위치는 allowsBackgroundLocationUpdates + UIBackgroundModes(location)
//     으로 받는다. https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background
//   그래서 안드로이드와 **같은 모양**으로 만든다 — start / stop / drain / status.
//   JS(trkBufDrain) 는 두 판을 가리지 않고 같은 문으로 부른다.
//
// ★ 쌓는 꼴도 안드로이드와 같다 — 한 줄에 점 하나, JSON
//   {"t":밀리초,"la":위도,"lo":경도,"ac":정확도,"sp":속도,"br":방향,"pv":"ios"}
//   (속도·방향은 음수면 모르는 것이라 안 적는다.)

import Foundation
import Capacitor
import CoreLocation

@objc(BaetnilTrack)
public class BaetnilTrack: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "BaetnilTrack"
    public let jsName = "BaetnilTrack"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop",   returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "drain",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "once",   returnType: CAPPluginReturnPromise)
    ]

    static let FILE = "baetnil_track.jsonl"
    static let MAX_BYTES = 4 * 1024 * 1024        // 넘으면 앞 절반을 버린다 (안드로이드와 같다)
    private var lm: CLLocationManager?
    private var running = false
    private let q = DispatchQueue(label: "kr.baetnil.track.file")

    private func fileURL() -> URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent(BaetnilTrack.FILE)
    }

    /// 기록을 켠다 — 사람이 앱 안에서 [기록 시작] 을 눌렀을 때만 불린다
    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let st = CLLocationManager().authorizationStatus
            if st != .authorizedAlways && st != .authorizedWhenInUse {
                // ★ 권한이 없으면 켜지 않는다. 권한은 앱의 다른 자리에서 이미 받는다.
                call.resolve(["started": false, "why": "no-permission"]); return
            }
            if self.lm == nil {
                let m = CLLocationManager()
                m.delegate = self
                m.desiredAccuracy = kCLLocationAccuracyBest
                m.distanceFilter = 10                       // 10m 움직일 때마다
                m.activityType = .otherNavigation           // 배 — 도로에 붙이지 않는다
                m.pausesLocationUpdatesAutomatically = false // ★ 멈춰 있어도 끄지 않는다 (정박 중에도)
                m.allowsBackgroundLocationUpdates = true     // ★ UIBackgroundModes 에 location 이 있어야 한다
                m.showsBackgroundLocationIndicator = true    // 기록 중임을 사람에게 보여 준다
                self.lm = m
            }
            self.lm?.startUpdatingLocation()
            self.running = true
            call.resolve(["started": true])
        }
    }

    /// 입항을 적었다 — 끈다
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.lm?.stopUpdatingLocation()
            self.running = false
            call.resolve(["stopped": true])
        }
    }

    /// 쌓인 점을 통째로 가져가고 파일을 비운다
    @objc func drain(_ call: CAPPluginCall) {
        q.async {
            var pts: [[String: Any]] = []
            var bad = 0
            let u = self.fileURL()
            if let s = try? String(contentsOf: u, encoding: .utf8) {
                for line in s.split(separator: "\n") {
                    let t = line.trimmingCharacters(in: .whitespaces)
                    if t.count < 2 { continue }
                    if let d = t.data(using: .utf8),
                       let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                        pts.append(o)
                    } else { bad += 1 }             // ★ 한 줄이 깨져도 나머지는 살린다
                }
                try? FileManager.default.removeItem(at: u)
            }
            call.resolve(["pts": pts, "bad": bad])
        }
    }

    /// 지금 돌고 있나 · 몇 바이트 쌓였나
    @objc func status(_ call: CAPPluginCall) {
        q.async {
            let u = self.fileURL()
            let n = (try? FileManager.default.attributesOfItem(atPath: u.path)[.size] as? NSNumber)?.intValue ?? 0
            call.resolve(["running": self.running, "bytes": n])
        }
    }

    /// ★ 6.0 — 지금 자리 한 번 읽기 (날씨 지점·홈포트·현재 위치 단추)
    ///   웹뷰의 navigator.geolocation 을 쓰면 아이폰은 앱 권한과 **따로**
    ///   「"localhost" would like to use your current location」 창을 한 번 더 띄운다.
    ///   (2026-09-22 시뮬레이터 검사 2회째 화면 사진에서 확인 — 검사 내내 그 창이 떠 있었다.)
    ///   사람에게 "localhost" 라는 낯선 이름이 보이고, 떠 있는 동안 애플 로그인 창도 못 뜬다.
    ///   그래서 아이폰에서는 코어로케이션으로 직접 한 번 읽는다. 권한 창은 앱 이름으로 한 번만 뜬다.
    private var shots: [BaetnilOneShot] = []
    @objc func once(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let o = BaetnilOneShot(call: call,
                                   high: call.getBool("high") ?? false,
                                   timeoutMs: call.getDouble("timeout") ?? 15000,
                                   maxAgeMs: call.getDouble("maxAge") ?? 0)
            o.done = { [weak self] x in self?.shots.removeAll { $0 === x } }
            self.shots.append(o)
            o.begin()
        }
    }

    // ── 점이 올 때마다 파일 끝에 한 줄씩 붙인다 (웹뷰가 멈춰 있어도 여기는 돈다)
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        var buf = ""
        for l in locations {
            var s = "{\"t\":\(Int64(l.timestamp.timeIntervalSince1970 * 1000))"
            s += ",\"la\":\(l.coordinate.latitude),\"lo\":\(l.coordinate.longitude)"
            if l.horizontalAccuracy >= 0 { s += ",\"ac\":\(l.horizontalAccuracy)" }
            if l.speed >= 0 { s += ",\"sp\":\(l.speed)" }
            if l.course >= 0 { s += ",\"br\":\(l.course)" }
            // ★ 5.10 — 거짓 위치 표시. 안드로이드(isMock → "mk":1)와 같게 맞춘다.
            //   이것이 없으면 화면이 꺼진 동안 쌓인 점은 거짓 위치 앱이 만든 것이어도 그대로 항적이 됐다.
            if #available(iOS 15.0, *), let si = l.sourceInformation, si.isSimulatedBySoftware { s += ",\"mk\":1" }
            s += ",\"pv\":\"ios\"}\n"
            buf += s
        }
        q.async { self.append(buf) }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // 잠깐 못 받는 것은 흔하다(터널·실내). 그대로 두면 다시 온다.
    }

    private func append(_ s: String) {
        let u = fileURL()
        guard let d = s.data(using: .utf8) else { return }
        if FileManager.default.fileExists(atPath: u.path) {
            if let h = try? FileHandle(forWritingTo: u) {
                h.seekToEndOfFile(); h.write(d); try? h.close()
            }
            trimIfBig(u)
        } else {
            try? d.write(to: u)
        }
    }

    private func trimIfBig(_ u: URL) {
        guard let n = (try? FileManager.default.attributesOfItem(atPath: u.path)[.size] as? NSNumber)?.intValue,
              n > BaetnilTrack.MAX_BYTES,
              let all = try? Data(contentsOf: u) else { return }
        let half = all.count / 2
        var cut = half
        while cut < all.count && all[cut] != 0x0A { cut += 1 }   // 줄 경계에서 자른다
        if cut + 1 < all.count { try? all.subdata(in: (cut + 1)..<all.count).write(to: u) }
    }
}


/// 한 번 읽고 끝나는 위치 요청. 항적을 쌓는 관리자(lm)와 섞이지 않게 따로 둔다.
///   실패 코드는 웹의 GeolocationPositionError 와 같게 맞춘다 — 1 거절 · 2 못 읽음 · 3 시간 넘김
final class BaetnilOneShot: NSObject, CLLocationManagerDelegate {
    let call: CAPPluginCall
    let high: Bool
    let timeoutMs: Double
    let maxAgeMs: Double
    var done: ((BaetnilOneShot) -> Void)?
    private let m = CLLocationManager()
    private var finished = false
    private var asked = false

    init(call: CAPPluginCall, high: Bool, timeoutMs: Double, maxAgeMs: Double) {
        self.call = call; self.high = high; self.timeoutMs = timeoutMs; self.maxAgeMs = maxAgeMs
        super.init()
    }

    func begin() {
        m.delegate = self
        m.desiredAccuracy = high ? kCLLocationAccuracyBest : kCLLocationAccuracyHundredMeters
        // 방금 읽은 것이 있으면 그것을 쓴다 (웹의 maximumAge 와 같은 뜻)
        if maxAgeMs > 0, let l = m.location, -l.timestamp.timeIntervalSinceNow * 1000 <= maxAgeMs,
           m.authorizationStatus == .authorizedWhenInUse || m.authorizationStatus == .authorizedAlways {
            ok(l); return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + max(1, timeoutMs) / 1000) { [weak self] in
            self?.fail("3", "timeout")
        }
        go()
    }

    private func go() {
        switch m.authorizationStatus {
        case .notDetermined:
            if !asked { asked = true; m.requestWhenInUseAuthorization() }   // 답은 아래 DidChangeAuthorization 으로 온다
        case .denied, .restricted:
            fail("1", "denied")
        default:
            m.requestLocation()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if finished { return }
        if manager.authorizationStatus == .notDetermined { return }
        go()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let l = locations.last { ok(l) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let e = error as? CLError, e.code == .denied { fail("1", "denied"); return }
        fail("2", error.localizedDescription)
    }

    private func ok(_ l: CLLocation) {
        if finished { return }
        finished = true
        var r: [String: Any] = [
            "lat": l.coordinate.latitude, "lon": l.coordinate.longitude,
            "acc": l.horizontalAccuracy, "t": l.timestamp.timeIntervalSince1970 * 1000
        ]
        if l.speed >= 0 { r["spd"] = l.speed }
        if l.course >= 0 { r["hdg"] = l.course }
        if l.verticalAccuracy >= 0 { r["alt"] = l.altitude }
        if #available(iOS 15.0, *), let si = l.sourceInformation { r["sim"] = si.isSimulatedBySoftware }
        call.resolve(r)
        end()
    }

    private func fail(_ code: String, _ msg: String) {
        if finished { return }
        finished = true
        call.reject(msg, code)
        end()
    }

    private func end() {
        m.stopUpdatingLocation()
        m.delegate = nil
        done?(self)
    }
}
