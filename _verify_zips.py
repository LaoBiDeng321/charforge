# 下载包自包含性检查
#
# 站点按目录打包下载（ZIP 内容 = <目录>/ 下全部文件），用户拿到的是包本身、不是整个仓库。
# 所以包内每个 .md 的相对链接都必须能在包内解析；指向包外的链接在下载包里就是死链。
#
# 用法：python _verify_zips.py   （退出码非 0 表示有死链）
import os, re, sys, zipfile, tempfile, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS = os.path.join(ROOT, "downloads")
PAT = re.compile(r"\]\(([^)\s]+?\.md)(?:#[^)]*)?\)")

def check_zip(zip_path):
    """解到临时目录后按包内视角解析链接；只用「包内未解析」判定失效。"""
    tmp = tempfile.mkdtemp(prefix="zipcheck_")
    bad, total = [], 0
    try:
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(tmp)
        for dirpath, _dirnames, filenames in os.walk(tmp):
            for fn in filenames:
                if not fn.endswith(".md"):
                    continue
                full = os.path.join(dirpath, fn)
                text = open(full, encoding="utf-8-sig", errors="replace").read()
                for m in PAT.finditer(text):
                    link = m.group(1)
                    if link.startswith(("http://", "https://", "mailto:")):
                        continue
                    total += 1
                    target = os.path.normpath(os.path.join(dirpath, link))
                    if not os.path.exists(target):
                        bad.append((os.path.relpath(full, tmp), link))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return total, bad

def main():
    if not os.path.isdir(DOWNLOADS):
        print("downloads/ 不存在，先跑 python build_data.py")
        return 1
    zips = []
    for kind in ("skills", "char"):
        d = os.path.join(DOWNLOADS, kind)
        if os.path.isdir(d):
            zips += [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.endswith(".zip")]
    broken_total = 0
    for z in zips:
        total, bad = check_zip(z)
        rel = os.path.relpath(z, ROOT)
        if bad:
            broken_total += len(bad)
            print("FAIL  %s（%d 条链接，%d 条失效）" % (rel, total, len(bad)))
            for name, link in bad:
                print("        %s  ->  %s" % (name, link))
        else:
            print("PASS  %s（%d 条链接全部在包内解析）" % (rel, total))
    print("\n共 %d 个包，失效链接 %d 条" % (len(zips), broken_total))
    return 1 if broken_total else 0

if __name__ == "__main__":
    sys.exit(main())
