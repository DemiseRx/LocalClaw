#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, os
PHRASE=os.environ.get('LOCALCLAW_TEST_PHRASE','LOCAL_TEST_PHRASE')
class H(BaseHTTPRequestHandler):
  def _json(self,obj,code=200):
    b=json.dumps(obj).encode(); self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
  def log_message(self,fmt,*args):
    return
  def do_GET(self):
    if self.path.startswith('/v1/models'):
      self._json({'object':'list','data':[{'id':'llama3.2:latest','object':'model'}]})
    else:
      self._json({'error':'not found'},404)
  def do_POST(self):
    l=int(self.headers.get('content-length','0')); raw=self.rfile.read(l).decode('utf-8') if l else '{}'
    try: data=json.loads(raw)
    except: data={}
    model=data.get('model','llama3.2:latest')
    if self.path.startswith('/v1/chat/completions'):
      self._json({'id':'cmpl-local-test','object':'chat.completion','model':model,'choices':[{'index':0,'message':{'role':'assistant','content':PHRASE},'finish_reason':'stop'}],'usage':{'prompt_tokens':3,'completion_tokens':2,'total_tokens':5}})
    elif self.path.startswith('/v1/responses'):
      self._json({'id':'resp-local-test','object':'response','model':model,'output':[{'id':'msg-local-test','type':'message','role':'assistant','content':[{'type':'output_text','text':PHRASE}]}],'usage':{'input_tokens':3,'output_tokens':2,'total_tokens':5}})
    else:
      self._json({'error':'not found'},404)

if __name__ == '__main__':
  HTTPServer(('127.0.0.1', int(os.environ.get('LOCALCLAW_TEST_PORT','11434'))), H).serve_forever()
