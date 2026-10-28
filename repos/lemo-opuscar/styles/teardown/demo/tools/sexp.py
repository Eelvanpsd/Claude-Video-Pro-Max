import re,sys
def parse(s):
    tok=re.compile(r'\(|\)|"(?:[^"\\]|\\.)*"|[^\s()"]+')
    stack=[[]]
    for m in tok.finditer(s):
        t=m.group(0)
        if t=='(':
            stack.append([])
        elif t==')':
            l=stack.pop(); stack[-1].append(l)
        else:
            if t[0]=='"': t=t[1:-1]
            stack[-1].append(t)
    return stack[0][0]
def kids(n,name): return [c for c in n if isinstance(c,list) and c and c[0]==name]
def kid(n,name):
    k=kids(n,name); return k[0] if k else None
