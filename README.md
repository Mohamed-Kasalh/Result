# بحث نتيجة الثانوية العامة (موقع Static - GitHub Pages)

موقع بحث سريع، شغال بالكامل جوه المتصفح (JavaScript) من غير أي سيرفر خلفي.
البيانات (919,396 طالب) بتتحمّل مرة واحدة كملف مضغوط، وبعدها البحث فوري.

## ✅ ليه الطريقة دي مش C#؟
GitHub Pages بيستضيف ملفات HTML/CSS/JS بس، ومش بيقدر يشغّل أكواد سيرفر زي C#.
فبدل الـ backend، البحث بقى كله بجافاسكريبت في متصفح الزائر نفسه - وده كمان بيخلي
الموقع مجاني ومفيهوش أي تكلفة استضافة، وسريع جدًا لأنه مش محتاج يكلم سيرفر أصلاً.

## 📁 محتويات الفولدر
```
index.html          الصفحة الرئيسية
app.js              كل منطق التحميل والبحث
data/results.txt.gz  بيانات النتيجة (مضغوطة، 14 ميجا)
build_data.py        سكريبت لو حبيت تحدّث البيانات بملف إكسل جديد
```

## 🚀 خطوات النشر على GitHub Pages

### 1. اعمل ريبو جديد على GitHub
من https://github.com/new اختار اسم زي `results-search` واعمله public.

### 2. ارفع الملفات
لو عندك git على جهازك:
```bash
cd ResultSearchSite
git init
git add .
git commit -m "أول نسخة من موقع بحث النتيجة"
git branch -M main
git remote add origin https://github.com/USERNAME/results-search.git
git push -u origin main
```
(استبدل USERNAME باسم حسابك، وresults-search باسم الريبو اللي عملته)

لو مش عايز تستخدم git من الترمينال، تقدر تسحب الملفات وتفلتها في صفحة الريبو على GitHub مباشرة (Add file → Upload files).

### 3. فعّل GitHub Pages
1. افتح الريبو على GitHub → Settings → Pages
2. تحت "Build and deployment" اختار Source: **Deploy from a branch**
3. اختار Branch: **main** والفولدر **/ (root)**
4. اضغط Save

خلال دقيقة أو اتنين هيديك رابط زي:
```
https://USERNAME.github.io/results-search/
```
ده الرابط اللي تشاركه مع الناس عشان يدوروا على نتيجتهم.

## 🔄 تحديث البيانات مستقبلًا
لو حبيت تستبدل النتيجة بملف إكسل جديد (سنة تانية مثلًا):
```bash
pip install openpyxl
python build_data.py "path/to/new_file.xlsx"
```
هيحدّث `data/results.txt.gz` تلقائيًا. بعدها `git add`, `git commit`, `git push`
عادي وهيتحدث الموقع المنشور خلال دقايق.

## ⚙️ التوافق
البحث بيستخدم `DecompressionStream` (خاصية موجودة في كل المتصفحات الحديثة:
Chrome/Edge/Firefox/Safari الإصدارات الحديثة). لو حد بيستخدم متصفح قديم جدًا
هيظهرله رسالة توضح إنه يحدّث المتصفح.

## 🧪 تجربة الموقع محليًا قبل النشر
```bash
cd ResultSearchSite
python3 -m http.server 8000
```
وبعدين افتح `http://localhost:8000` في المتصفح.
(المهم إنك تفتحه عن طريق سيرفر مش تفتح ملف index.html مباشرة، عشان الـ fetch يشتغل)
