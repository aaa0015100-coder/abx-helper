# 瀏覽器測試（Playwright）
# python3 tests/e2e.py                → 快速：390 深淺色＋1280，各分頁開啟、溢出、undefined/NaN、出處彈出層、0 錯誤、0 網路請求
# python3 tests/e2e.py --wide         → 另加 320／768
# python3 tests/e2e.py --full         → 320／390／768／1280 深淺色，經驗性治療所有部位×診斷×嚴重度、所有分頁按鈕點過
# python3 tests/e2e.py --shots=<dir>  → 存 390 淺／深、1280 截圖
import sys, os, re
from playwright.sync_api import sync_playwright
FULL = "--full" in sys.argv
WIDE = "--wide" in sys.argv or FULL
SHOTS = next((a.split("=",1)[1] for a in sys.argv if a.startswith("--shots=")), None)
HTML = "file://" + os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "index.html"))
WIDTHS = [320, 390, 768, 1280] if WIDE else [390, 1280]
errs, issues, net = [], [], []
BAD = re.compile(r"undefined|NaN|\[object|Infinity")

def check(pg, W, where):
    sw = pg.evaluate("document.documentElement.scrollWidth")
    if sw > W: issues.append(f"{W} {where}: 橫向溢出 {sw}")
    t = pg.inner_text("body")
    m = BAD.search(t)
    if m: issues.append(f"{W} {where}: 文字含 {m.group(0)}")

def click_all(pg, sel, W, where):
    n = pg.locator(sel).count()
    for i in range(n):
        loc = pg.locator(sel).nth(i)
        if loc.is_visible():
            loc.click(); check(pg, W, f"{where} #{i}")

def go_tab(pg, k):
    pg.evaluate(f"document.querySelector('[data-act=tab][data-v={k}]').click()")

with sync_playwright() as p:
    b = p.chromium.launch()
    for W in WIDTHS:
        for scheme in (["light", "dark"] if (W == 390 or FULL) else ["light"]):
            pg = b.new_page(viewport={"width": W, "height": 800}, color_scheme=scheme)
            pg.on("pageerror", lambda e, W=W: errs.append(f"{W}:{e}"))
            pg.on("console", lambda m, W=W: errs.append(f"{W}:{m.text}") if m.type == "error" else None)
            pg.on("request", lambda r: net.append(r.url) if not r.url.startswith("file:") and not r.url.startswith("data:") else None)
            pg.goto(HTML); pg.wait_for_timeout(200)
            check(pg, W, "load")
            tabs = pg.evaluate("[...document.querySelectorAll('#tabs [data-act=tab]')].map(e=>e.dataset.v)")
            # 手機：更多選單可開關；寬螢幕：更多按鈕不顯示
            mb = pg.locator("[data-act=more]")
            if W <= 920:
                mb.click(); pg.wait_for_timeout(50)
                if pg.locator("#tabmenu").is_hidden(): issues.append(f"{W}: 更多選單沒有展開")
                pg.locator("#tabmenu [data-act=tab]").first.click()
                if not pg.locator("#tabmenu").is_hidden(): issues.append(f"{W}: 選完分頁更多選單未收起")
                if pg.locator("#ptBar").is_hidden(): issues.append(f"{W}: 手機病人摘要列未顯示")
            else:
                if mb.is_visible(): issues.append(f"{W}: 寬螢幕仍顯示更多按鈕")
                if pg.locator("#ptBody").is_hidden(): issues.append(f"{W}: 寬螢幕病人卡被收合")
            for k in tabs:
                go_tab(pg, k); pg.wait_for_timeout(30)
                if k == "emp":
                    pg.locator("[data-act=sys][data-v=gu]").click()
                    pg.locator("[data-act=sub][data-v=pyelo]").click()
                check(pg, W, f"tab {k}")
                if FULL:
                    click_all(pg, "#main button[data-act]:not([data-act=copy]):not([data-act=fav-save]):not([data-act=fav-del])", W, f"tab {k} 按鈕")
                    pg.evaluate("document.querySelectorAll('#main details').forEach(d=>d.open=true)"); check(pg, W, f"tab {k} 全展開")
            # v0.9–v0.12：搜尋 → 藥物頁、縮寫、TDM、PEN-FAST、泌尿手術預防
            pg.fill("#q", "cefe"); pg.wait_for_timeout(50)
            if pg.locator("#qres .qitem").count()==0: issues.append(f"{W}: 搜尋沒有結果")
            else:
                pg.locator("#qres .qitem").first.click(); pg.wait_for_timeout(50)
                if "Cefepime" not in pg.inner_text("#main"): issues.append(f"{W}: 搜尋選藥未開藥物頁")
            check(pg, W, "藥物頁")
            pg.fill("#q", "腎盂"); pg.keyboard.press("Enter"); pg.wait_for_timeout(50)
            if "腎盂腎炎" not in pg.inner_text("#main"): issues.append(f"{W}: 搜尋診斷未跳到經驗性治療")
            gl = pg.locator("#main button.gl:visible").first
            if gl.count()==0: issues.append(f"{W}: 沒有縮寫按鈕")
            else:
                gl.click()
                if pg.locator("#ov").is_hidden() or not pg.inner_text("#ovB").strip(): issues.append(f"{W}: 縮寫未開啟彈出層")
                pg.locator("[data-act=ov-close]").click()
            go_tab(pg, "tdm"); pg.wait_for_timeout(30)
            for td in ["teico","gent","amk","vanco"]:
                pg.locator(f"[data-act=tdm][data-v={td}]").click(); check(pg, W, f"TDM {td}")
            pg.locator("[data-act=tdm][data-v=gent]").click()
            pg.fill("#ag_c1","12"); pg.fill("#ag_t1","1.5"); pg.fill("#ag_c2","2"); pg.fill("#ag_t2","12"); pg.locator("#ag_t2").blur(); pg.wait_for_timeout(50)
            if "半衰期" not in pg.inner_text("#main"): issues.append(f"{W}: 兩點濃度未計算")
            check(pg, W, "TDM 計算")
            go_tab(pg, "px"); pg.wait_for_timeout(30)
            if pg.locator("[data-act=proc][data-v=pcn]").count()==0: pg.locator("[data-act=pxpick]").click()
            pg.locator("[data-act=proc][data-v=pcn]").click(); check(pg, W, "px pcn")
            if "SIR" not in pg.inner_text("#main"): issues.append(f"{W}: PCN 未顯示 SIR")
            if W <= 920: pg.locator("#ptBar").click()
            pg.locator("#pfDet summary").click(); pg.locator("#pf5").check(); pg.wait_for_timeout(30)
            if "低風險" not in pg.inner_text("#pfRes"): issues.append(f"{W}: PEN-FAST 未顯示低風險")
            pg.locator("[data-act=pf-apply]").click(); pg.wait_for_timeout(30)
            if pg.eval_on_selector("#allergy","e=>e.value")!="pen_low": issues.append(f"{W}: PEN-FAST 套用未改過敏分類")
            pg.locator("#pf5").uncheck(); pg.select_option("#allergy","none"); pg.wait_for_timeout(30)
            if W <= 920: pg.locator("[data-act=pt-close]").click()
            check(pg, W, "PEN-FAST 後")
            # v0.13：Child-Pugh → 藥物頁反白；清除全部
            if W <= 920: pg.locator("#ptBar").click()
            pg.fill("#cpBili","2.5"); pg.fill("#cpAlb","3"); pg.fill("#cpInr","2"); pg.select_option("#cpAsc","2"); pg.wait_for_timeout(50)
            if "Child-Pugh B" not in pg.inner_text("#cpRes"): issues.append(f"{W}: Child-Pugh 未算出 B")
            pg.evaluate("document.querySelector('[data-act=tab][data-v=drug]').click()"); pg.wait_for_timeout(30)
            if pg.locator("[data-act=dpick]").count(): pg.locator("[data-act=dpick]").click()
            pg.locator("[data-act=drug][data-v=caspo]").click(); pg.wait_for_timeout(30)
            if "目前 Child-Pugh B" not in pg.inner_text("#main"): issues.append(f"{W}: 藥物頁未顯示目前 Child-Pugh")
            check(pg, W, "藥物頁肝功能")
            if W <= 920 and pg.locator("#ptBody").is_hidden(): pg.locator("#ptBar").click()
            pg.fill("#age","50"); pg.locator("#pf5").check(force=True) if pg.locator("#pf5").is_visible() else None
            pg.locator("[data-act=clear-all]").click(); pg.wait_for_timeout(50)
            if pg.eval_on_selector("#age","e=>e.value") or pg.eval_on_selector("#cpBili","e=>e.value") or "Child-Pugh" in pg.inner_text("#cpRes").split("輸入")[0][:0]: issues.append(f"{W}: 清除全部後仍有資料")
            if "Child-Pugh B" in pg.inner_text("#cpRes"): issues.append(f"{W}: 清除後 Child-Pugh 未清空")
            if W <= 920: pg.locator("[data-act=pt-close]").click()
            go_tab(pg, "emp")
            # 出處／更新彈出層
            go_tab(pg, "emp"); pg.wait_for_timeout(30)
            pg.evaluate("document.querySelectorAll('#main details').forEach(d=>d.open=true)")
            for sel in ["button.src", "button.upd"]:
                loc = pg.locator("#main " + sel).first
                if loc.count():
                    loc.click()
                    if pg.locator("#ov").is_hidden() or not pg.inner_text("#ovB").strip(): issues.append(f"{W}: {sel} 未開啟彈出層")
                    pg.locator("[data-act=ov-close]").click()
            # 藥名展開、說明展開
            bb = pg.locator("#main [data-act=brand]").first
            if bb.count():
                bb.click()
                if bb.get_attribute("aria-expanded") != "true": issues.append(f"{W}: 藥名未展開")
            on = pg.locator("#main [data-act=onote]").first
            if on.count():
                on.click()
                if on.get_attribute("aria-expanded") != "true": issues.append(f"{W}: 說明未展開")
            # 病人資料：手機開啟→輸入→摘要
            if W <= 920:
                pg.locator("#ptBar").click()
            pg.fill("#age", "72"); pg.fill("#wt", "60"); pg.fill("#ht", "165"); pg.fill("#scr", "1.6")
            pg.wait_for_timeout(50)
            if "CrCl" not in pg.inner_text("#main"): issues.append(f"{W}: 輸入腎功能後建議未依 CrCl")
            if W <= 920:
                pg.locator("[data-act=pt-close]").click()
                if "CrCl" not in pg.inner_text("#ptBar"): issues.append(f"{W}: 摘要列未顯示 CrCl")
            # 其他方式
            if pg.locator("#mMore").is_hidden():
                if W <= 920: pg.locator("#ptBar").click()
                pg.locator("[data-act=m-more]").click()
                pg.locator("input[name=method][value=hd]").check(force=True); pg.wait_for_timeout(50)
                if "HD" not in pg.inner_text("#main") and "血液透析" not in pg.inner_text("#main"): issues.append(f"{W}: 選 HD 後建議未更新")
            check(pg, W, "病人資料後")
            # 免責聲明收合
            pg.locator("[data-act=disc-ok]").click()
            if pg.locator("#footDisc").is_hidden(): issues.append(f"{W}: 免責聲明未移到頁尾")
            if FULL and W in (390, 1280):
                go_tab(pg, "emp")
                syss = pg.evaluate("Object.keys(SYS)")
                for s in syss:
                    pg.locator("[data-act=edit][data-v=sys]").click() if pg.locator("[data-act=edit][data-v=sys]").count() else None
                    pg.locator(f"[data-act=sys][data-v={s}]").click()
                    subs = pg.evaluate(f"SYS['{s}'].subs.map(x=>x.id)")
                    for u in subs:
                        if pg.locator(f"[data-act=sub][data-v={u}]").count() == 0:
                            pg.locator("[data-act=edit][data-v=sub]").click()
                        pg.locator(f"[data-act=sub][data-v={u}]").click()
                        for sev in ["none", "sepsis", "shock"]:
                            l = pg.locator(f"[data-act=sev][data-v={sev}]")
                            if l.count(): l.click()
                            check(pg, W, f"emp {s}/{u}/{sev}")
            if SHOTS and W in (390, 1280):
                os.makedirs(SHOTS, exist_ok=True)
                pg.reload(); pg.wait_for_timeout(150)
                pg.screenshot(path=f"{SHOTS}/{W}_{scheme}_start.png")
                pg.locator("[data-act=sys][data-v=gu]").click(); pg.locator("[data-act=sub][data-v=pyelo]").click()
                pg.screenshot(path=f"{SHOTS}/{W}_{scheme}_pyelo.png", full_page=True)
            pg.close()
    b.close()
print("ISSUES", len(issues)); [print("  " + i) for i in issues[:40]]
print("ERRORS", len(errs)); [print("  " + e) for e in errs[:20]]
print("NETWORK", len(net)); [print("  " + u) for u in net[:10]]
sys.exit(1 if (issues or errs or net) else 0)
