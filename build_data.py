"""
سكريبت لبناء ملف data/results.txt.gz من ملف إكسل النتيجة.
استخدمه لو عايز تحدّث الموقع بنتيجة سنة جديدة، أو بملف تاني.

الاستخدام:
    pip install openpyxl
    python build_data.py "path/to/نتيجة.xlsx"

الملف لازم يكون فيه 4 أعمدة بالترتيب ده (والصف الأول عناوين):
    seating_no | arabic_name | total_degree | student_case_desc
"""
import sys
import gzip
import openpyxl

# لو ظهرت في ملفك حالة جديدة مش موجودة هنا، ضيفها هنا برقم جديد
CASE_MAP = {
    'ناجح دور أول': 0,
    'دور ثان': 1,
    'راسب دور أول': 2,
    'غياب كلى دور أول': 3,
}


def build(xlsx_path: str, out_path: str = "data/results.txt.gz"):
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
    with gzip.open(out_path, "wt", encoding="utf-8", compresslevel=9) as f:
        f.write(data)

    print(f"تم إنشاء {out_path} - عدد السجلات: {len(lines):,}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("الاستخدام: python build_data.py path/to/file.xlsx")
        sys.exit(1)
    build(sys.argv[1])
