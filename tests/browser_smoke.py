#!/usr/bin/env python3
"""Optional Chromium Playwright smoke test: mobile UI, pet picking, separate budgets, persistence."""
import asyncio
import functools
import http.server
import socketserver
import threading
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

async def main():
    handler=functools.partial(QuietHandler,directory=str(ROOT))
    srv=socketserver.TCPServer(('127.0.0.1',0),handler)
    threading.Thread(target=srv.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{srv.server_address[1]}/index.html'
    errors=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        ctx=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
        page=await ctx.new_page()
        page.on('pageerror',lambda e: errors.append(str(e)))
        await page.goto(url)
        await page.locator('[data-start="demo"]').click()
        assert await page.locator('#modePill').inner_text()=='⚡ Тест-режим'
        await page.locator('[data-do="lab"][data-kind="synthesize"]').click()
        assert int((await page.locator('#molsStat').inner_text()).replace('.',''))>=8
        await page.locator('[data-do="nextDay"]').click()
        assert '2' in await page.locator('#dayPill').inner_text()
        await page.wait_for_timeout(350)
        await page.reload()
        assert await page.locator('#welcome').is_hidden()
        assert '2' in await page.locator('#dayPill').inner_text()
        await ctx.close()
        ctx2=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
        page2=await ctx2.new_page()
        page2.on('pageerror',lambda e: errors.append(str(e)))
        await page2.goto(url)
        await page2.evaluate('''() => {
          const E=window.TrialumEngine;
          const s=E.newGame('demo');
          s.stage=6;s.insight=500;s.compounds=500;s.biomass=500;
          for(const k of E.ELEMENTS)s.elements[k]=999;
          E.startBuilding(s,'lagoon');
          for(let i=0;i<5;i++){E.demoNext(s);E.buildStep(s)}
          E.createPet(s,0);E.createPet(s,1);
          s.selectedPet=s.pets[1].id;
          localStorage.setItem('trialum_state_v1_1',JSON.stringify(s));
        }''')
        await page2.reload()
        assert await page2.locator('#welcome').is_hidden()
        rect=await page2.locator('#world').bounding_box()
        await page2.mouse.click(rect['x']+rect['width']*342/1100,rect['y']+rect['height']*315/625)
        await page2.wait_for_timeout(180)
        assert 'Лумира' in await page2.locator('#petDetails').inner_text(), 'Canvas selection did not select first pet'
        await page2.locator('#petDetails [data-do="petCare"][data-kind="feed"]').click()
        assert '3/4' in (await page2.locator('#careBadge').inner_text()).replace(' ','')
        await page2.mouse.click(rect['x']+rect['width']*708/1100,rect['y']+rect['height']*315/625)
        await page2.wait_for_timeout(160)
        assert 'Кристел' in await page2.locator('#petDetails').inner_text()
        assert '4/4' in (await page2.locator('#careBadge').inner_text()).replace(' ','')
        await page2.wait_for_timeout(450)
        await page2.reload()
        assert 'Кристел' in await page2.locator('#petDetails').inner_text()
        assert '4/4' in (await page2.locator('#careBadge').inner_text()).replace(' ','')
        await page2.screenshot(path=str(ROOT/'tests'/'mobile_smoke.png'),full_page=True)
        await ctx2.close()
        await browser.close()
    srv.shutdown();srv.server_close()
    assert not errors,errors
    print('PASS browser: mobile viewport, chemistry, demo day, persistence, canvas selection, individual actions, reload')

if __name__=='__main__':asyncio.run(main())
