"""
سكريبت لبناء ملف data/results.js من ملف إكسل النتيجة.
استخدمه لو عايز تحدّث الموقع بنتيجة سنة جديدة، أو بملف تاني.

ليه .js مش .gz؟
عشان الموقع يفتح مباشرة بدون أي طلب شبكة (fetch) للبيانات - ده بيحل مشكلة
"Failed to fetch" لما حد يفتح index.html بالدبل كليك (file://)، وبيخلي
البيانات جاهزة فورًا من أول ما الصفحة تفتح. البيانات لسه متضغوطة بالـ gzip
جوه الملف (base64) فحجمها يفضل صغير زي ملف الـ .gz القديم تقريبًا.

الاستخدام:
    pip install openpyxl
    python build_data.py "path/to/نتيجة.xlsx"

الملف لازم يكون فيه 4 أعمدة بالترتيب ده (والصف الأول عناوين):
    seating_no | arabic_name | total_degree | student_case_desc
"""
import sys
import os
import gzip
import base64
import openpyxl

# لو ظهرت في ملفك حالة جديدة مش موجودة هنا، ضيفها هنا برقم جديد
CASE_MAP = {
    'ناجح دور أول': 0,
    'دور ثان': 1,
    'راسب دور أول': 2,
    'غياب كلى دور أول': 3,
}


def build(xlsx_path: str, out_path: str = "data/results.js"):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb.active

    lines = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        seating, name, total, desc = row[0], row[1], row[2], row[3]
        if not name:
            continue
        desc_clean = (desc or "").strip()
        code = CASE_MAP.get(desc_clean, 9)  # 9 = حالة غير معروفة
        if total is None:
            total_s = ""
        else:
            total_f = float(total)
            total_s = str(int(total_f)) if total_f.is_integer() else str(total_f)
        lines.append(f"{seating}|{str(name).strip()}|{total_s}|{code}")

    data = "\n".join(lines)
    compressed = gzip.compress(data.encode("utf-8"), compresslevel=9)
    b64 = base64.b64encode(compressed).decode("ascii")

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("// ملف بيانات النتيجة - يتولد تلقائيًا من build_data.py، لا تعدله يدويًا\n")
        f.write('window.__RESULTS_B64__ = "' + b64 + '";\n')

    print(f"تم إنشاء {out_path} - عدد السجلات: {len(lines):,}")


def build_from_gz(gz_path: str, out_path: str = "data/results.js"):
    """لو عندك ملف results.txt.gz جاهز أصلاً (من نسخة قديمة من الموقع)،
    استخدم الدالة دي علشان تحوّله لـ results.js من غير ما تعيد بناءه من الإكسل."""
    with open(gz_path, "rb") as f:
        compressed = f.read()
    b64 = base64.b64encode(compressed).decode("ascii")

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("// ملف بيانات النتيجة - يتولد تلقائيًا من build_data.py، لا تعدله يدويًا\n")
        f.write('window.__RESULTS_B64__ = "' + b64 + '";\n')

    print(f"تم إنشاء {out_path} من {gz_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("الاستخدام: python build_data.py path/to/file.xlsx")
        print("   أو (لو عندك gz جاهز): python build_data.py path/to/results.txt.gz --from-gz")
        sys.exit(1)

    input_path = sys.argv[1]
    if input_path.endswith(".gz") or "--from-gz" in sys.argv:
        build_from_gz(input_path)
    else:
        build(input_path)
