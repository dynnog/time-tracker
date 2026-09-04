import { useEffect, useMemo, useState } from "react";
import { archiveCustomer, createCustomer, listCustomers, updateCustomer } from "../db/customers";
import type { Customer } from "../types";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    try {
      setCustomers(await listCustomers(true));
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => { void reload(); }, []);

  const filtered = useMemo(() => customers.filter((customer) => {
    const matchesSearch = customer.name.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (showArchived || customer.active === 1);
  }), [customers, search, showArchived]);

  async function save() {
    if (!name.trim()) return;
    setError("");
    try {
      if (editing) await updateCustomer(editing.id, name, notes, editing.active === 1);
      else await createCustomer(name, notes);
      setName(""); setNotes(""); setEditing(null);
      await reload();
    } catch (e) {
      setError(String(e));
    }
  }

  function beginEdit(customer: Customer) {
    setEditing(customer); setName(customer.name); setNotes(customer.notes ?? "");
  }

  async function toggleArchive(customer: Customer) {
    if (customer.active === 1) await archiveCustomer(customer.id);
    else await updateCustomer(customer.id, customer.name, customer.notes ?? "", true);
    if (editing?.id === customer.id) { setEditing(null); setName(""); setNotes(""); }
    await reload();
  }

  return (
    <section className="page">
      <header className="page-header split-header">
        <div><p className="eyebrow">Projects</p><h1>Customers</h1><p>Keep your working list short. Archive customers without losing historical references.</p></div>
      </header>
      {error && <div className="alert error">{error}</div>}
      <div className="customer-layout">
        <div>
          <div className="toolbar">
            <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers" />
            <label className="checkbox"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
          </div>
          <div className="customer-list">
            {filtered.map((customer) => (
              <article className={customer.active ? "customer-row" : "customer-row archived"} key={customer.id}>
                <div><strong>{customer.name}</strong><p>{customer.notes || "No notes"}</p></div>
                <div className="row-actions"><button className="secondary" onClick={() => beginEdit(customer)}>Edit</button><button className="ghost" onClick={() => void toggleArchive(customer)}>{customer.active ? "Archive" : "Restore"}</button></div>
              </article>
            ))}
            {filtered.length === 0 && <div className="empty-state">No customers match this view.</div>}
          </div>
        </div>
        <aside className="editor-card">
          <h2>{editing ? "Edit customer" : "Add customer"}</h2>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ARUI" /></label>
          <label>Notes <span className="optional">Optional</span><textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <button className="primary" onClick={() => void save()} disabled={!name.trim()}>{editing ? "Save Changes" : "Add Customer"}</button>
          {editing && <button className="ghost full" onClick={() => { setEditing(null); setName(""); setNotes(""); }}>Cancel</button>}
        </aside>
      </div>
    </section>
  );
}
