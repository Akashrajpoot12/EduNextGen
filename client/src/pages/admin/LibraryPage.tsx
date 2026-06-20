import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/layout/DashboardLayout";
import { Plus, Trash2, BookOpen, RotateCcw, X, ScanBarcode, Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";

type LibraryBook = {
  id: string;
  school_id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  publisher: string;
  publish_year: number;
  total_copies: number;
  available_copies: number;
  rack_location: string;
};

type LibraryIssue = {
  id: string;
  school_id: string;
  book_id: string;
  student_id: string;
  issued_to_name: string;
  issued_by: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  fine_amount: number;
  status: string;
  library_books?: LibraryBook;
};

export function LibraryPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [issues, setIssues] = useState<LibraryIssue[]>([]);
  const [searchBook, setSearchBook] = useState("");
  const [issueFilter, setIssueFilter] = useState("all");
  const [showAddBook, setShowAddBook] = useState(false);
  const [showIssueBook, setShowIssueBook] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"books" | "issues" | "scanner">("books");

  // Barcode scanner state
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const scannerRef  = useRef<any>(null);
  const [scanActive, setScanActive]   = useState(false);
  const [scannedISBN, setScannedISBN] = useState("");
  const [scannedBook, setScannedBook] = useState<LibraryBook | null>(null);
  const [scanIssueForm, setScanIssueForm] = useState({ issued_to_name: "", due_date: "" });
  const [scanMode, setScanMode]       = useState<"issue" | "return">("issue");

  async function startScanner() {
    if (!(window as any).BarcodeDetector) {
      toast.error("BarcodeDetector API not supported. Use Chrome/Edge on desktop.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanActive(true);

      const detector = new (window as any).BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "qr_code"] });
      scannerRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const isbn = barcodes[0].rawValue;
            clearInterval(scannerRef.current);
            stopScanner();
            setScannedISBN(isbn);
            // lookup book
            const { data } = await supabase.from("library_books").select("*").eq("school_id", schoolId).eq("isbn", isbn).maybeSingle();
            if (data) { setScannedBook(data); toast.success(`Book found: ${data.title}`); }
            else toast.error(`No book found with ISBN: ${isbn}`);
          }
        } catch {}
      }, 500);
    } catch (err: any) {
      toast.error("Camera error: " + err.message);
    }
  }

  function stopScanner() {
    clearInterval(scannerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanActive(false);
  }

  async function handleScanIssue() {
    if (!scannedBook) return;
    await supabase.from("library_issues").insert({
      school_id: schoolId, book_id: scannedBook.id,
      issued_to_name: scanIssueForm.issued_to_name,
      due_date: scanIssueForm.due_date,
      issue_date: new Date().toISOString().split("T")[0],
      status: "issued", fine_amount: 0,
    });
    await supabase.from("library_books").update({ available_copies: Math.max(0, scannedBook.available_copies - 1) }).eq("id", scannedBook.id);
    toast.success(`Book issued to ${scanIssueForm.issued_to_name}`);
    setScannedBook(null); setScannedISBN(""); setScanIssueForm({ issued_to_name: "", due_date: "" });
    fetchBooks(); fetchIssues();
  }

  async function handleScanReturn() {
    if (!scannedBook) return;
    const issue = issues.find(i => i.book_id === scannedBook.id && i.status === "issued");
    if (!issue) { toast.error("No active issue found for this book"); return; }
    await handleReturnBook(issue);
    toast.success(`Book returned: ${scannedBook.title}`);
    setScannedBook(null); setScannedISBN("");
  }
  const [bookForm, setBookForm] = useState({ title: "", author: "", isbn: "", category: "", publisher: "", publish_year: new Date().getFullYear(), total_copies: 1, available_copies: 1, rack_location: "" });
  const [issueForm, setIssueForm] = useState({ book_id: "", student_id: "", issued_to_name: "", due_date: "" });

  async function fetchBooks() {
    const { data } = await supabase.from("library_books").select("*").eq("school_id", schoolId).order("title");
    setBooks(data || []);
  }

  async function fetchIssues() {
    let query = supabase.from("library_issues").select("*, library_books(title, author)").eq("school_id", schoolId).order("issue_date", { ascending: false });
    if (issueFilter !== "all") query = query.eq("status", issueFilter);
    const { data } = await query;
    setIssues(data || []);
  }

  useEffect(() => { if (schoolId) { fetchBooks(); fetchIssues(); } }, [schoolId]);
  useEffect(() => { if (schoolId) fetchIssues(); }, [issueFilter]);

  async function handleAddBook() {
    setLoading(true);
    await supabase.from("library_books").insert({ ...bookForm, school_id: schoolId });
    setLoading(false);
    setShowAddBook(false);
    setBookForm({ title: "", author: "", isbn: "", category: "", publisher: "", publish_year: new Date().getFullYear(), total_copies: 1, available_copies: 1, rack_location: "" });
    fetchBooks();
  }

  async function handleDeleteBook(id: string) {
    await supabase.from("library_books").delete().eq("id", id);
    fetchBooks();
  }

  async function handleIssueBook() {
    setLoading(true);
    await supabase.from("library_issues").insert({ ...issueForm, school_id: schoolId, issue_date: new Date().toISOString().split("T")[0], status: "issued", fine_amount: 0 });
    await supabase.from("library_books").update({ available_copies: supabase.rpc as any }).eq("id", issueForm.book_id);
    const book = books.find((b) => b.id === issueForm.book_id);
    if (book) await supabase.from("library_books").update({ available_copies: Math.max(0, book.available_copies - 1) }).eq("id", issueForm.book_id);
    setLoading(false);
    setShowIssueBook(false);
    setIssueForm({ book_id: "", student_id: "", issued_to_name: "", due_date: "" });
    fetchBooks();
    fetchIssues();
  }

  async function handleReturnBook(issue: LibraryIssue) {
    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(issue.due_date);
    const returnDate = new Date(today);
    const daysOverdue = Math.max(0, Math.floor((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    const fine = daysOverdue * 2;
    await supabase.from("library_issues").update({ return_date: today, status: daysOverdue > 0 ? "overdue" : "returned", fine_amount: fine }).eq("id", issue.id);
    const book = books.find((b) => b.id === issue.book_id);
    if (book) await supabase.from("library_books").update({ available_copies: book.available_copies + 1 }).eq("id", issue.book_id);
    fetchBooks();
    fetchIssues();
  }

  const filteredBooks = books.filter((b) => b.title.toLowerCase().includes(searchBook.toLowerCase()) || b.author.toLowerCase().includes(searchBook.toLowerCase()));
  const totalBooks = books.reduce((s, b) => s + b.total_copies, 0);
  const availableBooks = books.reduce((s, b) => s + b.available_copies, 0);
  const issuedCount = issues.filter((i) => i.status === "issued").length;
  const overdueCount = issues.filter((i) => i.status === "overdue").length;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div><h1>Library Management</h1><p>Books catalog, issue &amp; return, overdue tracking</p></div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Books", value: totalBooks, color: "card-accent-blue" },
          { label: "Available", value: availableBooks, color: "card-accent-green" },
          { label: "Issued", value: issuedCount, color: "card-accent-orange" },
          { label: "Overdue", value: overdueCount, color: "card-accent-red" },
        ].map(c => (
          <div key={c.label} className={`bg-card rounded-xl p-4 shadow-sm border border-border ${c.color}`}>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value.toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        {([
          { key: "books",   label: "Books Catalog" },
          { key: "issues",  label: "Issue / Return" },
          { key: "scanner", label: "Barcode Scanner" },
        ] as const).map(({ key, label }) => (
          <button key={key} type="button" onClick={() => { if (key !== "scanner") stopScanner(); setActiveTab(key); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {key === "scanner" && <ScanBarcode className="w-3.5 h-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {activeTab === "books" && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <input placeholder="Search by title or author…" value={searchBook} onChange={e => setSearchBook(e.target.value)} title="Search books" className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-72" />
            <button type="button" onClick={() => setShowAddBook(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              <Plus className="w-4 h-4" />Add Book
            </button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th>Total</th><th>Available</th><th>Rack</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredBooks.length === 0 && <tr><td colSpan={8} className="text-center text-muted-foreground py-10">No books found.</td></tr>}
                {filteredBooks.map(b => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.title}</td>
                    <td>{b.author}</td>
                    <td className="text-muted-foreground text-xs">{b.isbn || "—"}</td>
                    <td><span className="badge-gray">{b.category}</span></td>
                    <td>{b.total_copies}</td>
                    <td><span className={b.available_copies === 0 ? "text-red-500 font-bold" : "text-emerald-600 font-bold"}>{b.available_copies}</span></td>
                    <td className="text-muted-foreground">{b.rack_location || "—"}</td>
                    <td><button type="button" title="Delete book" onClick={() => handleDeleteBook(b.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "issues" && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <select title="Filter by status" value={issueFilter} onChange={e => setIssueFilter(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="all">All</option>
              <option value="issued">Issued</option>
              <option value="returned">Returned</option>
              <option value="overdue">Overdue</option>
            </select>
            <button type="button" onClick={() => setShowIssueBook(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              <BookOpen className="w-4 h-4" />Issue Book
            </button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full edu-table">
              <thead><tr><th>Book</th><th>Issued To</th><th>Issue Date</th><th>Due Date</th><th>Return Date</th><th>Fine</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {issues.length === 0 && <tr><td colSpan={8} className="text-center text-muted-foreground py-10">No records found.</td></tr>}
                {issues.map(issue => {
                  const todayD = new Date();
                  const due = new Date(issue.due_date);
                  const daysOver = !issue.return_date && todayD > due ? Math.floor((todayD.getTime() - due.getTime()) / 86400000) : 0;
                  const fine = daysOver * 2;
                  const statusBadge = issue.status === "returned" ? "badge-green" : daysOver > 0 ? "badge-red" : "badge-blue";
                  return (
                    <tr key={issue.id}>
                      <td className="font-medium">{(issue.library_books as Record<string, string> | undefined)?.title || "—"}</td>
                      <td>{issue.issued_to_name}</td>
                      <td className="text-sm">{issue.issue_date}</td>
                      <td className="text-sm">{issue.due_date}</td>
                      <td className="text-sm">{issue.return_date || "—"}</td>
                      <td>{(issue.fine_amount > 0 || fine > 0) ? <span className="text-red-500 font-medium">₹{(issue.fine_amount || fine).toLocaleString("en-IN")}</span> : "—"}</td>
                      <td><span className={statusBadge}>{daysOver > 0 ? `Overdue ${daysOver}d` : issue.status}</span></td>
                      <td>
                        {!issue.return_date && (
                          <button type="button" onClick={() => handleReturnBook(issue)} className="flex items-center gap-1 text-xs border border-border px-2 py-1 rounded hover:bg-muted">
                            <RotateCcw className="w-3 h-3" />Return
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Barcode Scanner Tab ── */}
      {activeTab === "scanner" && (
        <div className="space-y-4 max-w-xl">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Barcode / ISBN Scanner</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Point camera at book barcode to issue or return</p>
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setScanMode("issue")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${scanMode === "issue" ? "bg-emerald-500 text-white border-emerald-500" : "border-border hover:bg-muted"}`}>
                  Issue
                </button>
                <button type="button"
                  onClick={() => setScanMode("return")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${scanMode === "return" ? "bg-blue-500 text-white border-blue-500" : "border-border hover:bg-muted"}`}>
                  Return
                </button>
              </div>
            </div>

            {/* Camera preview */}
            <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${scanActive ? "block" : "hidden"}`} />
              {!scanActive && (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Camera className="w-10 h-10 opacity-40" />
                  <p className="text-xs">Camera inactive</p>
                </div>
              )}
              {scanActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-24 border-2 border-emerald-400 rounded-lg opacity-70" />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!scanActive ? (
                <button type="button" onClick={startScanner}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <Camera className="w-4 h-4" /> Start Scanner
                </button>
              ) : (
                <button type="button" onClick={stopScanner}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <CameraOff className="w-4 h-4" /> Stop Scanner
                </button>
              )}
            </div>

            {/* Manual ISBN input */}
            <div className="flex gap-2">
              <input value={scannedISBN} onChange={e => setScannedISBN(e.target.value)}
                placeholder="Or type ISBN manually..."
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button type="button"
                onClick={async () => {
                  const { data } = await supabase.from("library_books").select("*").eq("school_id", schoolId).eq("isbn", scannedISBN).maybeSingle();
                  if (data) { setScannedBook(data); toast.success(`Book: ${data.title}`); }
                  else toast.error("No book found with this ISBN");
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
                Lookup
              </button>
            </div>
          </div>

          {/* Book found card */}
          {scannedBook && (
            <div className="bg-card border border-emerald-500/30 rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold">{scannedBook.title}</p>
                  <p className="text-sm text-muted-foreground">{scannedBook.author} · ISBN: {scannedBook.isbn}</p>
                  <p className="text-xs mt-1">
                    <span className={scannedBook.available_copies > 0 ? "text-emerald-600" : "text-red-500"}>
                      {scannedBook.available_copies} available
                    </span>
                    {" "}/ {scannedBook.total_copies} total
                  </p>
                </div>
              </div>

              {scanMode === "issue" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Issued To (Student Name) *</label>
                    <input value={scanIssueForm.issued_to_name} onChange={e => setScanIssueForm(f => ({ ...f, issued_to_name: e.target.value }))}
                      placeholder="Student full name"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Due Date *</label>
                    <input type="date" title="Due date" value={scanIssueForm.due_date} onChange={e => setScanIssueForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <button type="button" onClick={handleScanIssue} disabled={!scanIssueForm.issued_to_name || !scanIssueForm.due_date || scannedBook.available_copies === 0}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50">
                    {scannedBook.available_copies === 0 ? "No copies available" : "Issue Book"}
                  </button>
                </div>
              )}

              {scanMode === "return" && (
                <button type="button" onClick={handleScanReturn}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-lg py-2 text-sm font-medium transition-colors">
                  Return This Book
                </button>
              )}

              <button type="button" onClick={() => { setScannedBook(null); setScannedISBN(""); }}
                className="w-full border border-border text-muted-foreground rounded-lg py-2 text-sm hover:bg-muted transition-colors">
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {showAddBook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Add Book</h2>
              <button type="button" title="Close" onClick={() => setShowAddBook(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs text-muted-foreground block mb-1">Title *</label><input required value={bookForm.title} onChange={e => setBookForm({ ...bookForm, title: e.target.value })} placeholder="Book title" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Author</label><input value={bookForm.author} onChange={e => setBookForm({ ...bookForm, author: e.target.value })} placeholder="Author name" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">ISBN</label><input value={bookForm.isbn} onChange={e => setBookForm({ ...bookForm, isbn: e.target.value })} placeholder="ISBN" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Category</label><input value={bookForm.category} onChange={e => setBookForm({ ...bookForm, category: e.target.value })} placeholder="Category" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Publisher</label><input value={bookForm.publisher} onChange={e => setBookForm({ ...bookForm, publisher: e.target.value })} placeholder="Publisher" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Publish Year</label><input type="number" value={bookForm.publish_year} onChange={e => setBookForm({ ...bookForm, publish_year: parseInt(e.target.value) })} title="Publish year" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Total Copies</label><input type="number" value={bookForm.total_copies} onChange={e => setBookForm({ ...bookForm, total_copies: parseInt(e.target.value), available_copies: parseInt(e.target.value) })} title="Total copies" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Rack Location</label><input value={bookForm.rack_location} onChange={e => setBookForm({ ...bookForm, rack_location: e.target.value })} placeholder="e.g. A-12" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowAddBook(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleAddBook} disabled={loading || !bookForm.title} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{loading ? "Saving…" : "Add Book"}</button>
            </div>
          </div>
        </div>
      )}

      {showIssueBook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Issue Book</h2>
              <button type="button" title="Close" onClick={() => setShowIssueBook(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground block mb-1">Select Book *</label>
                <select required title="Select book" value={issueForm.book_id} onChange={e => setIssueForm({ ...issueForm, book_id: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">Choose a book</option>
                  {books.filter(b => b.available_copies > 0).map(b => <option key={b.id} value={b.id}>{b.title} ({b.available_copies} available)</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground block mb-1">Issued To (Name) *</label><input required value={issueForm.issued_to_name} onChange={e => setIssueForm({ ...issueForm, issued_to_name: e.target.value })} placeholder="Student or person name" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Due Date *</label><input required type="date" title="Due date" value={issueForm.due_date} onChange={e => setIssueForm({ ...issueForm, due_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowIssueBook(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handleIssueBook} disabled={loading || !issueForm.book_id || !issueForm.issued_to_name || !issueForm.due_date} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{loading ? "Saving…" : "Issue Book"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
