import sys
import os
import json
import struct
import threading
import socketserver
import http.client
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

# --- Native Messaging Protocol ---

def get_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack('=I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def send_message(message_dict):
    content = json.dumps(message_dict).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(content)))
    sys.stdout.buffer.write(content)
    sys.stdout.buffer.flush()

# --- Persistence ---

RULES_FILE = os.path.join(os.path.dirname(__file__), "straws.json")

def load_rules():
    if os.path.exists(RULES_FILE):
        try:
            with open(RULES_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_rules(rules):
    try:
        with open(RULES_FILE, "w") as f:
            json.dump(rules, f, indent=4)
    except Exception as e:
        with open("/tmp/straws.log", "a") as f:
            f.write(f"Save Error: {str(e)}\n")

# In-memory map from hostname to target URL/port
STRAWS = load_rules()

class StrawsProxyHandler(BaseHTTPRequestHandler):
    def handle_request(self):
        host_header = self.headers.get('Host')
        if not host_header:
            self.send_error(400, "Missing Host header")
            return

        hostname = host_header.split(':')[0]
        rule = STRAWS.get(hostname)

        if rule:
            if isinstance(rule, str):
                target = rule
                custom_headers = {}
            else:
                target = rule.get('target', '') if rule else ''
                custom_headers = rule.get('headers', {}) if rule else {}

            parsed_target = urllib.parse.urlparse(target)
            target_host = str(parsed_target.netloc or target)
            
            try:
                headers = {k: v for k, v in self.headers.items() if k.lower() != 'host'}
                headers['Host'] = target_host

                for k, v in custom_headers.items():
                    headers[k] = v

                with open("/tmp/straws.log", "a") as f:
                    f.write(f"[Proxy] {self.command} {self.path} -> {target_host}\n")

                parsed_request = urllib.parse.urlparse(self.path)
                forward_path = parsed_request.path or '/'
                if parsed_request.query:
                    forward_path += '?' + parsed_request.query

                conn = http.client.HTTPConnection(target_host)
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length) if content_length > 0 else None
                
                conn.request(self.command, forward_path, body, headers)

                res = conn.getresponse()
                
                # Send log to extension
                send_message({
                    "type": "request_log",
                    "log": {
                        "method": self.command,
                        "hostname": hostname,
                        "path": forward_path,
                        "target": target_host,
                        "status": res.status
                    }
                })

                self.send_response(res.status)
                for k, v in res.getheaders():
                    self.send_header(k, v)
                self.end_headers()
                self.wfile.write(res.read())
                conn.close()
            except Exception as e:
                # Send error log to extension
                send_message({
                    "type": "request_log",
                    "log": {
                        "method": self.command,
                        "hostname": hostname,
                        "path": self.path,
                        "target": "ERROR",
                        "status": 502
                    }
                })
                with open("/tmp/straws.log", "a") as f:
                    f.write(f"[Proxy] Error: {str(e)}\n")
                self.send_error(502, f"Proxy Error: {str(e)}")
        else:
            self.send_error(404, f"No straw for {hostname}")


    def do_CONNECT(self):
        """Handle HTTPS tunneling."""
        host, port = self.path.split(":")
        rule = STRAWS.get(host)
        
        if rule:
            if isinstance(rule, str):
                target = rule
            else:
                target = rule.get('target', '')
            
            parsed = urllib.parse.urlparse(target)
            target_host = parsed.hostname or host
            target_port = parsed.port or int(port)
        else:
            self.send_error(404, f"No straw for {host}")
            return


        try:
            import socket
            sock = socket.create_connection((target_host, target_port))
            
            self.send_response(200, "Connection Established")
            self.end_headers()
            
            # Send log to extension
            send_message({
                "type": "request_log",
                "log": {
                    "method": "CONNECT",
                    "hostname": host,
                    "path": f"{host}:{port}",
                    "target": target_host,
                    "status": 200
                }
            })

            self.relay_data(self.connection, sock)
        except Exception as e:
            # Send error log to extension
            send_message({
                "type": "request_log",
                "log": {
                    "method": "CONNECT",
                    "hostname": host,
                    "path": f"{host}:{port}",
                    "target": "ERROR",
                    "status": 502
                }
            })
            self.send_error(502, f"Connect Error: {str(e)}")

    def relay_data(self, client_sock, target_sock):
        import select
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
        finally:
            client_sock.close()
            target_sock.close()

    def do_GET(self): self.handle_request()
    def do_POST(self): self.handle_request()
    def do_PUT(self): self.handle_request()
    def do_DELETE(self): self.handle_request()

def run_proxy(port=9000):
    server = HTTPServer(('127.0.0.1', port), StrawsProxyHandler)
    server.serve_forever()

# --- Main Bridge Loop ---

def main():
    proxy_thread = threading.Thread(target=run_proxy, daemon=True)
    proxy_thread.start()

    while True:
        try:
            msg = get_message()
            if msg is None:
                break
            
            command = msg.get('type')
            
            if command == 'ping':
                send_message({"type": "pong", "status": "ok", "proxy_port": 9000})
            
            elif command == 'set_rules':
                global STRAWS
                STRAWS = msg.get('rules', {})
                save_rules(STRAWS)
                with open("/tmp/straws.log", "a") as f:
                    f.write(f"[Bridge] Straws updated and saved: {list(STRAWS.keys())}\n")
                send_message({"type": "straws_updated", "count": len(STRAWS)})
            
            elif command == 'log':
                text = msg.get('text', '')
                with open("/tmp/straws.log", "a") as f:
                    f.write(f"[EXT] {text}\n")
            
            elif command == 'get_status':
                send_message({"type": "status", "straws": STRAWS, "proxy_port": 9000})
            
            else:
                send_message({"type": "error", "message": f"Unknown command: {command}"})
                
        except Exception as e:
            with open("/tmp/straws.log", "a") as f:
                f.write(f"Error: {str(e)}\n")
            break

if __name__ == '__main__':
    main()
