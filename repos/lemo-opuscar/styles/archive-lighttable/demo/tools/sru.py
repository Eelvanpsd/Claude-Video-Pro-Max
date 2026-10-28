import sys, urllib.request, urllib.parse, re
q=sys.argv[1]; n=sys.argv[2] if len(sys.argv)>2 else '10'
u="http://lx2.loc.gov:210/lcdb?version=1.1&operation=searchRetrieve&recordSchema=marcxml&maximumRecords="+n+"&query="+urllib.parse.quote(q)
x=urllib.request.urlopen(u,timeout=60).read().decode()
print('hits', re.search(r'numberOfRecords>(\d+)',x).group(1))
for rec in x.split('<zs:record>')[1:]:
    out=[]
    for tag,codes in [('001',None),('010','a'),('245','abc'),('260','c'),('264','c'),('300','a'),('856','u'),('037','a'),('050','a'),('520','a'),('500','a')]:
        for m in re.finditer(r'<(?:marc:)?(?:datafield|controlfield) tag="%s"[^>]*>(.*?)</(?:marc:)?(?:datafield|controlfield)>'%tag, rec, re.S):
            body=m.group(1)
            if codes is None: out.append(tag+': '+body.strip()); continue
            subs=re.findall(r'code="([a-z0-9])">(.*?)</',body,re.S)
            out.append(tag+': '+' '.join(v for c,v in subs if c in codes))
    print('\n'.join(out)); print('======')
