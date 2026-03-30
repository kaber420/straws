import sys
import os
import json
import struct
import threading
import socket
import urllib.parse
import queue
import asyncio
import websockets
import http.client
import select
from http.server import BaseHTTPRequestHandler, HTTPServer, ThreadingHTTPServer
from datetime import datetime

# --- Global State ---
RULES_FILE = os.path.join(os.path.dirname(__file__), "straws.json")
COMMAND_PORT = 9001
PROXY_PORT = 9000
WS_PORT = 9002

class StrawsHost:
    def __init__(self):
        self.paused: bool = False
        self.rules: dict = self.load_rules()
        self.extension_connected: bool = False
        self.log_queue: queue.Queue = queue.Queue()
        self.proxy_thread: threading.Thread = None # type: ignore
        self.cmd_thread: threading.Thread = None # type: ignore
        self.running: bool = False

    def log(self, text, source="System"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        msg = f"[{timestamp}] [{source}] {text}"
        self.log_queue.put(msg)
        # Still write to stderr for debugging
        sys.stderr.write(msg + "\n")
        sys.stderr.flush()

    def load_rules(self):
        if os.path.exists(RULES_FILE):
            try:
                with open(RULES_FILE, "r") as f:
                    return json.load(f)
            except:
                return {}
        return {}

    def save_rules(self):
        try:
            with open(RULES_FILE, "w") as f:
                json.dump(self.rules, f, indent=4)
            self.log(f"Rules saved to {RULES_FILE}")
        except Exception as e:
            self.log(f"Save Error: {str(e)}", "Error")

    def handle_command(self, msg):
        cmd_type = msg.get('type')
        
        if cmd_type == 'ping':
            return {"type": "pong", "paused": self.paused, "rules_count": len(self.rules)}
        
        elif cmd_type == 'get_status':
            return {"type": "status", "rules": self.rules, "paused": self.paused, "proxy_port": PROXY_PORT}
        
        elif cmd_type == 'set_rules':
            self.rules = msg.get('rules', {})
            self.save_rules()
            self.notify_extension({"type": "rules_updated", "rules": self.rules})
            return {"status": "ok", "count": len(self.rules)}
        
        elif cmd_type == 'add_rule':
            host = msg.get('host')
            target = msg.get('target')
            if host and target:
                self.rules[host] = target
                self.save_rules()
                self.notify_extension({"type": "rules_updated", "rules": self.rules})
                return {"status": "ok", "host": host}
            return {"status": "error", "message": "Missing host or target"}
    
        elif cmd_type == 'remove_rule':
            host = msg.get('host')
            if host in self.rules:
                del self.rules[host]
                self.save_rules()
                self.notify_extension({"type": "rules_updated", "rules": self.rules})
                return {"status": "ok"}
            return {"status": "error", "message": "Rule not found"}
    
        elif cmd_type == 'toggle_pause':
            self.paused = not self.paused
            self.notify_extension({"type": "status_updated", "paused": self.paused})
            return {"status": "ok", "paused": self.paused}
    
        elif cmd_type == 'shutdown':
            self.log("Shutdown requested", "Control")
            self.stop()
            return {"status": "shutting_down"}
    
        return {"status": "error", "message": f"Unknown command: {cmd_type}"}

    def notify_extension(self, msg):
        if self.extension_connected:
            send_native_message(msg)

    def start(self):
        if self.running: return
        self.running = True
        self.proxy_thread = threading.Thread(target=self.run_proxy, daemon=True)
        self.cmd_thread = threading.Thread(target=self.run_socket_server, daemon=True)
        self.proxy_thread.start()
        self.cmd_thread.start()
        
    def start_sync(self):
        """Starts the host in a synchronous blocking loop (for standalone use)"""
        self.start()
        asyncio.run(self.run_ws_server())

    async def run_ws_server(self):
        self.log(f"WebSocket server starting on ws://127.0.0.1:{WS_PORT}", "WS")
        async with websockets.serve(self.handle_ws, "127.0.0.1", WS_PORT):
            await asyncio.Future()  # run forever

    async def handle_ws(self, websocket):
        self.log("Extension connected via WebSocket", "WS")
        self.extension_connected = True
        
        # Send initial state
        await websocket.send(json.dumps({
            "type": "ready", 
            "rules": self.rules, 
            "paused": self.paused
        }))

        try:
            async for message in websocket:
                try:
                    msg = json.loads(message)
                    response = self.handle_command(msg)
                    await websocket.send(json.dumps(response))
                except Exception as e:
                    self.log(f"WS Message Error: {e}", "Error")
        except websockets.exceptions.ConnectionClosed:
            self.log("Extension disconnected from WebSocket", "WS")
        finally:
            self.extension_connected = False

    def stop(self):
        self.running = False
        os._exit(0)

    def run_proxy(self):
        try:
            # Create a closure to pass the host instance
            host_instance = self
            class CustomHandler(StrawsProxyHandler):
                def __init__(self, *args, **kwargs):
                    self.host = host_instance
                    super().__init__(*args, **kwargs)
            
            server = ThreadingHTTPServer(('127.0.0.1', PROXY_PORT), CustomHandler)
            self.log(f"Proxy server active on http://127.0.0.1:{PROXY_PORT}", "Proxy")
            server.serve_forever()
        except Exception as e:
            self.log(f"Proxy server failed: {e}", "Error")

    def run_socket_server(self):
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            server.bind(('127.0.0.1', COMMAND_PORT))
            server.listen(5)
            self.log(f"Control server listening on port {COMMAND_PORT}", "Control")
        except Exception as e:
            self.log(f"Failed to bind control port {COMMAND_PORT}: {e}", "Error")
            return

        while self.running:
            try:
                server.settimeout(1.0)
                conn, addr = server.accept()
                threading.Thread(target=self.handle_socket_client, args=(conn,), daemon=True).start()
            except socket.timeout:
                continue
            except Exception as e:
                if self.running:
                    self.log(f"Socket server error: {e}", "Error")
                break

    def handle_socket_client(self, conn):
        try:
            data = conn.recv(4096).decode('utf-8')
            if not data: return
            msg = json.loads(data)
            response = self.handle_command(msg)
            conn.sendall(json.dumps(response).encode('utf-8'))
        except Exception as e:
            self.log(f"Socket client error: {e}", "Error")
        finally:
            conn.close()

# --- Proxy Server Handler ---
class StrawsProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        host_inst = getattr(self, 'host', None)
        if host_inst:
            host_inst.log(format % args, "Proxy")
        else:
            sys.stderr.write((format % args) + "\n")

    def handle_request(self):
        host_inst = getattr(self, 'host', None)
        if not host_inst:
            self.send_error(500, "Internal Server Error: Host not initialized")
            return

        if host_inst.paused:
            self.send_error(503, "Straws Proxy is Paused")
            return

        host_header = self.headers.get('Host')
        if not host_header:
            self.send_error(400, "Missing Host header")
            return

        hostname = host_header.split(':')[0]
        target = host_inst.rules.get(hostname)

        if target:
            if isinstance(target, dict):
                target_url = target.get('target', '')
            else:
                target_url = target

            parsed_target = urllib.parse.urlparse(target_url if "://" in target_url else f"http://{target_url}")
            host = parsed_target.hostname or target_url.split(':')[0]
            port = parsed_target.port or (int(target_url.split(':')[1]) if ':' in target_url and target_url.split(':')[1].isdigit() else 80)
            
            try:
                headers = {k: v for k, v in self.headers.items() if k.lower() != 'host'}
                headers['Host'] = f"{host}:{port}" if port != 80 else host

                path = self.path
                if not path.startswith('http'):
                    path = f"http://{host}:{port}{path}"
                
                parsed_path = urllib.parse.urlparse(path)
                conn = http.client.HTTPConnection(host, port, timeout=10)
                
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length) if content_length > 0 else None
                
                conn.request(self.command, parsed_path.path or '/', body, headers)
                res = conn.getresponse()
                
                self.send_response(res.status)
                for k, v in res.getheaders():
                    self.send_header(k, v)
                self.end_headers()
                self.wfile.write(res.read())
                conn.close()
                
                if host_inst:
                    host_inst.notify_extension({
                        "type": "traffic",
                        "data": {"method": self.command, "host": hostname, "target": f"{host}:{port}", "status": res.status}
                    })
            except Exception as e:
                if host_inst: host_inst.log(f"Proxy Error: {e}", "Error")
                self.send_error(502, f"Proxy Error: {str(e)}")
        else:
            self.send_error(404, f"No straw configured for {hostname}")

    def do_GET(self): self.handle_request()
    def do_POST(self): self.handle_request()
    def do_PUT(self): self.handle_request()
    def do_DELETE(self): self.handle_request()

    def do_CONNECT(self):
        host_inst = getattr(self, 'host', None)
        if not host_inst or host_inst.paused:
            self.send_error(503, "Straws Proxy is Paused or Uninitialized")
            return

        hostname, _ = self.path.split(":")
        target_data = host_inst.rules.get(hostname)
        
        if not target_data:
            self.send_error(404, f"No straw config for {hostname}")
            return

        target_url = target_data.get('target', str(target_data)) if isinstance(target_data, dict) else target_data
        parsed = urllib.parse.urlparse(target_url if "://" in target_url else f"http://{target_url}")
        target_host = parsed.hostname or target_url.split(':')[0]
        target_port = parsed.port or (int(target_url.split(':')[1]) if ':' in target_url and target_url.split(':')[1].isdigit() else 80)

        try:
            target_sock = socket.create_connection((target_host, target_port))
            self.send_response(200, "Connection Established")
            self.end_headers()
            
            if host_inst:
                host_inst.notify_extension({
                    "type": "traffic",
                    "data": {"method": "CONNECT", "host": hostname, "target": f"{target_host}:{target_port}", "status": 200}
                })

            self.relay_data(self.connection, target_sock)
        except Exception as e:
            if host_inst: host_inst.log(f"Connect Error: {e}", "Error")
            self.send_error(502, f"Connect Error: {str(e)}")

    def relay_data(self, client_sock, target_sock):
        socks = [client_sock, target_sock]
        try:
            while True:
                ins, _, _ = select.select(socks, [], [], 10)
                if not ins: break
                for s in ins:
                    other = target_sock if s is client_sock else client_sock
                    data = s.recv(8192)
                    if not data: return
                    other.sendall(data)
        except:
            pass

# --- Native Messaging Utils ---
def get_native_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length: return None
    message_length = struct.unpack('=I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def send_native_message(message_dict):
    try:
        content = json.dumps(message_dict).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('=I', len(content)))
        sys.stdout.buffer.write(content)
        sys.stdout.buffer.flush()
    except EOFError:
        pass

# --- CLI Mode ---
def send_cli_command(cmd_dict):
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        client.connect(('127.0.0.1', COMMAND_PORT))
        client.sendall(json.dumps(cmd_dict).encode('utf-8'))
        response = client.recv(4096).decode('utf-8')
        print(response)
    except Exception as e:
        print(f"Error connecting to host: {e}")
    finally:
        client.close()

# --- Main Entry ---
def main():
    host = StrawsHost()
    
    # Identify mode: CLI or Native
    is_cli = False
    if len(sys.argv) > 1:
        # Check if the argument is a known CLI flag
        arg = sys.argv[1]
        if arg in ['--add', '--remove', '--status', '--pause']:
            is_cli = True
        # Note: arg.startswith('chrome-extension://') is Chrome's way of identifying the source.
        # We don't consider this CLI mode.

    if is_cli:
        arg = sys.argv[1]
        if arg == '--add' and len(sys.argv) == 4:
            send_cli_command({"type": "add_rule", "host": sys.argv[2], "target": sys.argv[3]})
        elif arg == '--remove' and len(sys.argv) == 3:
            send_cli_command({"type": "remove_rule", "host": sys.argv[2]})
        elif arg == '--status':
            send_cli_command({"type": "get_status"})
        elif arg == '--pause':
            send_cli_command({"type": "toggle_pause"})
        else:
            print("Usage: bridge.py [--add host target | --remove host | --status | --pause]")
        return

    # Standalone Mode (Default)
    # This mode no longer depends on Chrome starting it.
    host.start_sync()

if __name__ == '__main__':
    main()
