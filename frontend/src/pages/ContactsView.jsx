import React, { useState, useEffect } from "react";
import { safeFetchJson } from "../utils/api";

export default function ContactsView() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchContacts() {
      try {
        const { data, res } = await safeFetchJson("/accounts/api/contacts/");
        if (res.ok && data.success) {
          setContacts(data.contacts || []);
        } else {
          setError(data.error || "Failed to fetch contacts.");
        }
      } catch (err) {
        setError(err.message || "Network error.");
      } finally {
        setLoading(false);
      }
    }
    fetchContacts();
  }, []);

  return (
    <section className="view on" id="v-contacts">
      <div className="hdr-row">
        <div>
          <h1 id="contacts-title">Your Assigned Contacts</h1>
          <p className="sub">
            The personnel registered during your onboarding phase.
          </p>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Loading contacts...</p>
        </div>
      )}

      {error && (
        <div style={{ color: "var(--brick)", padding: "20px" }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="table-wrapper">
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Role</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Name</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Email</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Phone</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Added On</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>
                    No contacts have been added yet.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: "12px 16px" }}>
                      <span className="tag idle">{c.role_name}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: "bold" }}>
                      {c.name}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {c.email || "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {c.phone || "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
