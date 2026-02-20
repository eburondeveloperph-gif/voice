"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/client/api";

type Contact = {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  tags: string | null;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    phoneNumber: "",
    email: "",
  });

  async function load() {
    const payload = await apiRequest<{ contacts: Contact[] }>(`/api/ev/contacts?q=${encodeURIComponent(query)}`);
    setContacts(payload.contacts);
  }

  useEffect(() => {
    let active = true;
    apiRequest<{ contacts: Contact[] }>(`/api/ev/contacts?q=${encodeURIComponent("")}`).then((payload) => {
      if (active) {
        setContacts(payload.contacts);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function addContact() {
    await apiRequest<{ contact: Contact }>("/api/ev/contacts", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        tags: ["imported"],
      }),
    });
    setForm({ fullName: "", phoneNumber: "", email: "" });
    await load();
  }

  return (
    <div>
      <header className="pageHead">
        <div>
          <h1 className="pageTitle">Contacts</h1>
          <p className="pageSubtitle">Upload, dedupe, tag, and search customer contacts.</p>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="fieldGrid">
          <label>
            Name
            <input value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
          </label>
          <label>
            Phone Number
            <input value={form.phoneNumber} onChange={(e) => setForm((s) => ({ ...s, phoneNumber: e.target.value }))} />
          </label>
          <label>
            Email
            <input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          </label>
          <div className="inlineActions">
            <button type="button" onClick={() => void addContact()}>
              Add Contact
            </button>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="inlineActions">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts"
            style={{ maxWidth: 320 }}
          />
          <button type="button" className="secondary" onClick={() => void load()}>
            Search
          </button>
        </div>
      </section>

      <section className="card">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>{contact.fullName}</td>
                  <td>{contact.phoneNumber}</td>
                  <td>{contact.email ?? "-"}</td>
                  <td>{contact.tags ?? "-"}</td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No contacts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
