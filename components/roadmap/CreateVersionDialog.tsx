"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import JalaliDateInput from "@/components/JalaliDateInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  buildVersionName,
  isValidProductVersion,
  isValidVersionProduct,
  listProductsFromVersions,
} from "@/lib/roadmap";
import type { JiraVersion, Language } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  versions: JiraVersion[];
  onCreated: () => void;
};

const copy = {
  en: {
    title: "New version",
    start: "Start date",
    end: "End date",
    product: "Product",
    pickProduct: "Existing product",
    productVer: "Product version",
    preview: "Fix Version name",
    create: "Create",
    creating: "Creating…",
    cancel: "Cancel",
    ok: "Version created.",
    fail: "Could not create version.",
    productHint: "Letters/digits, e.g. Club",
    versionHint: "e.g. 2.6",
    needFields: "Fill start, end, product, and version.",
  },
  fa: {
    title: "ورژن جدید",
    start: "تاریخ شروع",
    end: "تاریخ پایان",
    product: "محصول",
    pickProduct: "محصول موجود",
    productVer: "ورژن محصول",
    preview: "نام Fix Version",
    create: "ایجاد",
    creating: "در حال ایجاد…",
    cancel: "انصراف",
    ok: "ورژن ساخته شد.",
    fail: "ساخت ورژن ناموفق بود.",
    productHint: "حروف/عدد، مثل Club",
    versionHint: "مثل 2.6",
    needFields: "شروع، پایان، محصول و ورژن را پر کنید.",
  },
} as const;

export default function CreateVersionDialog({
  open,
  onOpenChange,
  language,
  versions,
  onCreated,
}: Props) {
  const t = copy[language];
  const products = useMemo(() => listProductsFromVersions(versions), [versions]);
  const productItems = useMemo(
    () => products.map((p) => ({ label: p, value: p })),
    [products]
  );

  const [startDate, setStartDate] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [product, setProduct] = useState("");
  const [version, setVersion] = useState("");
  const [saving, setSaving] = useState(false);

  const previewName = useMemo(
    () =>
      buildVersionName({
        startDate,
        product,
        version,
      }),
    [startDate, product, version]
  );

  const canCreate =
    !!previewName &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(releaseDate) &&
    startDate <= releaseDate &&
    isValidVersionProduct(product) &&
    isValidProductVersion(version);

  const reset = () => {
    setStartDate("");
    setReleaseDate("");
    setProduct("");
    setVersion("");
  };

  const handleCreate = async () => {
    if (!canCreate || !previewName) {
      toast.error(t.needFields);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/jira/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          releaseDate,
          product,
          version,
          name: previewName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.fail);
      toast.success(t.ok);
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.fail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <FieldGroup className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="version-create-start">{t.start}</FieldLabel>
              <JalaliDateInput
                id="version-create-start"
                language={language}
                value={startDate}
                onChange={setStartDate}
                disabled={saving}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="version-create-end">{t.end}</FieldLabel>
              <JalaliDateInput
                id="version-create-end"
                language={language}
                value={releaseDate}
                onChange={setReleaseDate}
                disabled={saving}
              />
            </Field>
          </div>

          {productItems.length > 0 ? (
            <Field>
              <FieldLabel>{t.pickProduct}</FieldLabel>
              <Select
                items={productItems}
                value={product || null}
                onValueChange={(v) => {
                  if (v != null) setProduct(String(v));
                }}
                disabled={saving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.pickProduct} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {products.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="version-create-product">{t.product}</FieldLabel>
              <Input
                id="version-create-product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                disabled={saving}
                placeholder="Club"
                autoComplete="off"
              />
              <FieldDescription>{t.productHint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="version-create-ver">{t.productVer}</FieldLabel>
              <Input
                id="version-create-ver"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                disabled={saving}
                placeholder="2.6"
                autoComplete="off"
              />
              <FieldDescription>{t.versionHint}</FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel>{t.preview}</FieldLabel>
            <Input
              value={previewName || "—"}
              readOnly
              disabled
              translate="no"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={saving || !canCreate}
          >
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {saving ? t.creating : t.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
