import curses
import threading
import time
import queue
import sys
import os
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from bridge import StrawsHost
from install import install as install_host

class StrawsTUI:
    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.host = StrawsHost()
        self.running = True
        self.paused = False
        
        # UI State
        self.logs: list[str] = []
        self.max_logs: int = 10
        
        # Colors
        curses.start_color()
        curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK)  # Header
        curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK) # Online
        curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK) # Paused
        curses.init_pair(4, curses.COLOR_RED, curses.COLOR_BLACK)    # Offline/Error
        curses.init_pair(5, curses.COLOR_WHITE, curses.COLOR_BLACK)  # Normal
        
        # Initialization
        curses.curs_set(0)
        self.stdscr.nodelay(True)
        self.stdscr.timeout(100)
        
    def draw_header(self):
        h, w = self.stdscr.getmaxyx()
        self.stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
        self.stdscr.addstr(0, 0, " " * w)
        self.stdscr.addstr(0, (w // 2) - 10, "STRAWS PROXY DASHBOARD")
        self.stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)

    def draw_status(self):
        h, w = self.stdscr.getmaxyx()
        y = 2
        status_text = "ONLINE" if self.host.running else "OFFLINE"
        color = curses.color_pair(2) if self.host.running else curses.color_pair(4)
        if self.host.paused:
            status_text = "PAUSED"
            color = curses.color_pair(3)
            
        self.stdscr.addstr(y, 2, "Status: ")
        self.stdscr.attron(color | curses.A_BOLD)
        self.stdscr.addstr(y, 10, status_text)
        self.stdscr.attroff(color | curses.A_BOLD)
        
        self.stdscr.addstr(y+1, 2, f"Rules: {len(self.host.rules)}")
        self.stdscr.addstr(y+2, 2, f"Proxy: http://127.0.0.1:9000")

    def draw_rules(self):
        h, w = self.stdscr.getmaxyx()
        y = 6
        self.stdscr.attron(curses.A_UNDERLINE)
        self.stdscr.addstr(y, 2, "ACTIVE RULES:")
        self.stdscr.attroff(curses.A_UNDERLINE)
        
        y += 1
        count = 0
        max_display = h - 15
        for host, target_data in self.host.rules.items():
            if y >= h - 12: break
            target = target_data.get('target', str(target_data)) if isinstance(target_data, dict) else target_data
            self.stdscr.addstr(y, 4, f"{host.ljust(20)} -> {target}")
            y += 1
            count += 1
            
        if not self.host.rules:
            self.stdscr.addstr(y, 4, "(No rules configured)")

    def draw_logs(self):
        h, w = self.stdscr.getmaxyx()
        start_y = h - 8
        self.stdscr.attron(curses.A_UNDERLINE)
        self.stdscr.addstr(start_y, 2, "RECENT TRAFFIC:")
        self.stdscr.attroff(curses.A_UNDERLINE)
        
        y = start_y + 1
        for log in self.logs[-6:]:
            self.stdscr.addstr(y, 4, log[:w-10])
            y += 1

    def draw_footer(self):
        h, w = self.stdscr.getmaxyx()
        if h < 1: return
        footer = "[S]tart | [P]ause | [I]nstall | [Q]uit"
        try:
            # We use w-1 to avoid the 'ERR' on the last character of the last line
            self.stdscr.attron(curses.color_pair(1))
            self.stdscr.addstr(h-1, 0, " " * (w - 1))
            start_x = max(0, (w // 2) - (len(footer) // 2))
            self.stdscr.addstr(h-1, start_x, footer[:w-1], curses.color_pair(1) | curses.A_BOLD)
            self.stdscr.attroff(curses.color_pair(1))
        except curses.error:
            pass

    def run(self):
        while self.running:
            self.stdscr.erase()
            
            # Process Logs
            while not self.host.log_queue.empty():
                self.logs.append(self.host.log_queue.get())
                if len(self.logs) > 50:
                    self.logs.pop(0)
            
            self.draw_header()
            self.draw_status()
            self.draw_rules()
            self.draw_logs()
            self.draw_footer()
            
            self.stdscr.refresh()
            
            try:
                key = self.stdscr.getch()
                if key == ord('q') or key == ord('Q'):
                    self.running = False
                elif key == ord('s') or key == ord('S'):
                    if not self.host.running:
                        self.host.start()
                elif key == ord('p') or key == ord('P'):
                    self.host.handle_command({"type": "toggle_pause"})
                elif key == ord('i') or key == ord('I'):
                    install_host()
                    self.host.log("Manifest installed to Chrome", "App")
            except:
                pass
            
            time.sleep(0.1)

def main():
    def run_app(stdscr, *args):
        StrawsTUI(stdscr).run()
    curses.wrapper(run_app)

if __name__ == "__main__":
    main()
