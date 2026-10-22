"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import type { AdminCategoryRow } from "@/types/admin";

interface Draft {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
}

const EMPTY: Draft = { name: "", slug: "", description: "", sortOrder: "10" };

export function CategoriesManager({ initial }: { initial: AdminCategoryRow[] }) {
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function startNew() {
    setEditing("new");
    setDraft({ ...EMPTY, sortOrder: String((rows.at(-1)?.sortOrder ?? 0) + 1) });
    setErrors({});
    setMessage(null);
  }

  function startEdit(row: AdminCategoryRow) {
    setEditing(row.id);
    setDraft({ name: row.name, slug: row.slug, description: row.description, sortOrder: String(row.sortOrder) });
    setErrors({});
    setMessage(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const next = await apiFetch<AdminCategoryRow[]>(
        editing === "new" ? "/api/admin/categories" : `/api/admin/categories/${editing}`,
        {
          method: editing === "new" ? "POST" : "PUT",
          body: JSON.stringify(draft),
        },
      );
      setRows(next);
      setEditing(null);
      setMessage(editing === "new" ? `Added "${draft.name}".` : `Saved "${draft.name}".`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""])));
        setMessage(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: AdminCategoryRow) {
    setBusy(true);
    try {
      setRows(await apiFetch<AdminCategoryRow[]>(`/api/admin/categories/${row.id}`, { method: "DELETE" }));
      setMessage(`Deleted "${row.name}".`);
    } catch (err) {
      setMessage(err instanceof ApiClientError ? err.message : "Could not delete this category.");
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }

  const form = (
    <form
      onSubmit={save}
      className="grid gap-3 rounded-2xl border border-neon-cyan/40 bg-obsidian-900 p-5 sm:grid-cols-6"
      noValidate
    >
      <div className="sm:col-span-3">
        <label htmlFor="cat-name" className="label">
          Name
        </label>
        <input
          id="cat-name"
          className="input py-2"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        {errors.name && <p className="mt-1 text-xs text-neon-magenta">{errors.name}</p>}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="cat-slug" className="label">
          Link name
        </label>
        <input
          id="cat-slug"
          className="input py-2 font-mono"
          value={draft.slug}
          placeholder="made from the name"
          onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
        />
        {errors.slug && <p className="mt-1 text-xs text-neon-magenta">{errors.slug}</p>}
      </div>
      <div>
        <label htmlFor="cat-order" className="label">
          Order
        </label>
        <input
          id="cat-order"
          inputMode="numeric"
          className="input py-2 font-mono"
          value={draft.sortOrder}
          onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value.replace(/[^0-9]/g, "") })}
        />
      </div>
      <div className="sm:col-span-6">
        <label htmlFor="cat-description" className="label">
          Description
        </label>
        <input
          id="cat-description"
          className="input py-2"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        {errors.description && <p className="mt-1 text-xs text-neon-magenta">{errors.description}</p>}
      </div>
      <div className="flex gap-2 sm:col-span-6">
        <button type="submit" className="btn-primary py-2" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing === "new" ? "Add category" : "Save"}
        </button>
        <button type="button" className="btn-ghost py-2" onClick={() => setEditing(null)}>
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {message ? (
          <p className="text-sm text-ink-300" role="status">
            {message}
          </p>
        ) : (
          <span />
        )}
        {editing === null && (
          <button type="button" className="btn-primary" onClick={startNew}>
            <Plus className="h-4 w-4" /> Add category
          </button>
        )}
      </div>

      {editing === "new" && form}

      <ul className="space-y-2">
        {rows.map((row) =>
          editing === row.id ? (
            <li key={row.id}>{form}</li>
          ) : (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-obsidian-700 bg-obsidian-900/70 px-5 py-4"
            >
              <span className="w-8 font-mono text-xs text-ink-500">#{row.sortOrder}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{row.name}</p>
                <p className="truncate text-xs text-ink-500">
                  /shop?category={row.slug} · {row.description}
                </p>
              </div>
              <Link href={`/admin/products`} className="font-mono text-xs text-ink-400 hover:text-neon-cyan">
                {row.productCount} product{row.productCount === 1 ? "" : "s"}
              </Link>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => startEdit(row)}
                  aria-label={`Edit ${row.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {confirmDelete === row.id ? (
                  <span className="flex items-center gap-2 text-xs">
                    Delete?
                    <button
                      type="button"
                      className="chip border-neon-magenta/50 text-neon-magenta"
                      disabled={busy}
                      onClick={() => remove(row)}
                    >
                      Yes
                    </button>
                    <button type="button" className="chip" onClick={() => setConfirmDelete(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="icon-btn hover:text-neon-magenta disabled:opacity-30"
                    onClick={() => setConfirmDelete(row.id)}
                    disabled={row.productCount > 0}
                    title={row.productCount > 0 ? "Only empty categories can be deleted" : undefined}
                    aria-label={`Delete ${row.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
