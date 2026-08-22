"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  buildDebtDetails,
  DebtFields,
  debtValuesFromDetails,
  defaultDebtValues,
  type DebtValues,
} from "@/components/debt-fields";
import {
  applyEquityPatch,
  buildEquityDetails,
  defaultEquityValues,
  EquityFields,
  equityValuesFromDetails,
  type EquityValues,
} from "@/components/equity-fields";
import {
  buildGoldDetails,
  defaultGoldValues,
  GoldFields,
  goldValuesFromDetails,
  type GoldValues,
} from "@/components/gold-fields";
import { Field, Select, TextArea, TextInput } from "@/components/form";
import { Button, Card } from "@/components/ui";
import { debtKindForType, valueDebtAsset, type DebtKind } from "@/lib/debt";
import { equityKindForType, valueEquityAsset } from "@/lib/equity";
import { goldLotName, isPhysicalGold, valueGoldAsset } from "@/lib/gold";
import { useStore } from "@/lib/store";
import { ASSET_CATEGORIES, type Asset, type AssetCategory } from "@/lib/types";

interface AssetFormValues {
  name: string;
  categoryId: Asset["categoryId"];
  type: string;
  institution: string;
  investedAmount: string;
  currentValue: string;
  startDate: string;
  notes: string;
}

function toValues(asset: Asset): AssetFormValues {
  return {
    name: asset.name,
    categoryId: asset.categoryId,
    type: asset.type,
    institution: asset.institution,
    investedAmount: String(asset.investedAmount),
    currentValue: String(asset.currentValue),
    startDate: asset.startDate,
    notes: asset.notes,
  };
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** "FD / RD" covers two instruments, so the deposit style is picked separately. */
function isDepositType(type: string): boolean {
  return type === "FD / RD";
}

/** Where the holding is kept, worded for the kind of asset it is. */
function institutionLabel(categoryId: string, type: string): {
  label: string;
  hint: string;
  placeholder: string;
} {
  const equityKind = equityKindForType(categoryId, type);
  if (equityKind) {
    return {
      label: equityKind === "mutual-fund" ? "Where is it kept?" : "Demat / broker",
      hint: equityKind === "mutual-fund" ? "Platform or AMC" : "Optional",
      placeholder:
        equityKind === "mutual-fund"
          ? "Example: Groww, Zerodha Coin"
          : "Example: Zerodha, Groww",
    };
  }
  if (isPhysicalGold(categoryId, type)) {
    return {
      label: "Jeweller",
      hint: "Optional",
      placeholder: "Example: Tanishq, local jeweller",
    };
  }
  if (categoryId === "debt" && type === "Bonds") {
    return {
      label: "Broker / platform",
      hint: "Optional",
      placeholder: "Example: GoldenPi, IndiaBonds, Zerodha",
    };
  }
  return {
    label: "Where is it kept?",
    hint: "Bank, app or company name",
    placeholder: "Example: Zerodha, SBI",
  };
}

export function AssetForm({
  category,
  type,
  asset,
}: {
  category: AssetCategory;
  type: string;
  asset?: Asset;
}) {
  const router = useRouter();
  const { addAsset, updateAsset } = useStore();
  const [values, setValues] = useState<AssetFormValues>(
    asset
      ? toValues(asset)
      : {
          name: "",
          categoryId: category.id,
          type,
          institution: "",
          investedAmount: "",
          currentValue: "",
          startDate: "",
          notes: "",
        },
  );
  const [depositKind, setDepositKind] = useState<DebtKind>(
    asset?.debtDetails?.kind === "rd" ? "rd" : "fd",
  );
  const [debtValues, setDebtValues] = useState<DebtValues>(() => {
    const initialKind = debtKindForType(
      asset?.categoryId ?? category.id,
      asset?.type ?? type,
    );
    if (!initialKind) return {};
    if (asset?.debtDetails) return debtValuesFromDetails(asset.debtDetails);
    return defaultDebtValues(initialKind);
  });
  const [equityValues, setEquityValues] = useState<EquityValues>(() => {
    const initialKind = equityKindForType(
      asset?.categoryId ?? category.id,
      asset?.type ?? type,
    );
    if (!initialKind) return {};
    if (asset?.equityDetails) return equityValuesFromDetails(asset.equityDetails);
    return defaultEquityValues(initialKind);
  });
  const [goldValues, setGoldValues] = useState<GoldValues>(() => {
    if (asset?.goldDetails) return goldValuesFromDetails(asset.goldDetails);
    if (isPhysicalGold(asset?.categoryId ?? category.id, asset?.type ?? type)) {
      return defaultGoldValues();
    }
    return {};
  });
  const [error, setError] = useState("");

  const selectedCategory =
    ASSET_CATEGORIES.find((c) => c.id === values.categoryId) ?? category;

  const baseKind = debtKindForType(values.categoryId, values.type);
  const debtKind =
    baseKind === "fd" && isDepositType(values.type) ? depositKind : baseKind;
  const equityKind = equityKindForType(values.categoryId, values.type);
  const physicalGold = isPhysicalGold(values.categoryId, values.type);
  const institution = institutionLabel(values.categoryId, values.type);

  function set<K extends keyof AssetFormValues>(
    key: K,
    value: AssetFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function switchDebtKind(nextKind: DebtKind | undefined) {
    setDebtValues(nextKind ? defaultDebtValues(nextKind) : {});
  }

  function switchKinds(nextCategoryId: string, nextType: string) {
    switchDebtKind(debtKindForType(nextCategoryId, nextType));
    const nextEquityKind = equityKindForType(nextCategoryId, nextType);
    setEquityValues(nextEquityKind ? defaultEquityValues(nextEquityKind) : {});
    setGoldValues(
      isPhysicalGold(nextCategoryId, nextType) ? defaultGoldValues() : {},
    );
  }

  const patchEquity = useCallback((patch: EquityValues) => {
    setEquityValues((prev) => applyEquityPatch(prev, patch));
  }, []);

  const patchGold = useCallback((patch: GoldValues) => {
    setGoldValues((prev) => ({ ...prev, ...patch }));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const equityDetails = equityKind
      ? buildEquityDetails(equityKind, equityValues)
      : undefined;
    const debtDetails = debtKind
      ? buildDebtDetails(debtKind, debtValues)
      : undefined;
    const goldDetails = physicalGold ? buildGoldDetails(goldValues) : undefined;
    const name =
      values.name.trim() ||
      equityDetails?.instrumentName.trim() ||
      (debtDetails?.kind === "bond" ? debtDetails.instrumentName?.trim() : "") ||
      (goldDetails ? goldLotName(goldDetails, values.notes) : "") ||
      "";

    if (!name) {
      setError(
        equityKind
          ? "Please pick the fund or share this holding is in."
          : debtKind === "bond"
            ? "Please pick the bond this holding is in."
            : "Please give this asset a name.",
      );
      return;
    }
    if (goldDetails) {
      if (!(goldDetails.weightGrams > 0)) {
        setError("Please enter the weight in grams.");
        return;
      }
      if (!goldDetails.purchaseDate) {
        setError("Please enter the purchase date.");
        return;
      }
      if (!(goldDetails.amountPaid > 0)) {
        setError("Please enter the amount you paid.");
        return;
      }
    }
    if (debtKind === "bond" && debtDetails?.kind === "bond") {
      if (
        !(debtDetails.investedAmount && debtDetails.investedAmount > 0) &&
        !(debtDetails.quantity > 0 && debtDetails.buyPrice > 0)
      ) {
        setError("Please enter the amount you invested.");
        return;
      }
      if (!debtDetails.startDate) {
        setError("Please enter the purchase date.");
        return;
      }
    }
    if (equityDetails && !(equityDetails.units > 0)) {
      setError(
        equityKind === "mutual-fund"
          ? "Please enter how many units you hold."
          : "Please enter the quantity you hold.",
      );
      return;
    }
    if (equityDetails && !(equityDetails.investedAmount > 0)) {
      setError("Please enter the total amount you put in.");
      return;
    }
    if (
      equityDetails?.mode === "sip" &&
      (!((equityDetails.sipAmount ?? 0) > 0) || !((equityDetails.sipDay ?? 0) > 0))
    ) {
      setError("Please enter the SIP amount and the day it is debited.");
      return;
    }

    const valuation = goldDetails
      ? valueGoldAsset(goldDetails)
      : debtDetails
        ? valueDebtAsset(debtDetails)
        : equityDetails
          ? valueEquityAsset(equityDetails)
          : undefined;

    const payload = {
      name,
      categoryId: values.categoryId,
      type: values.type,
      institution: values.institution.trim(),
      investedAmount: valuation
        ? valuation.invested
        : toNumber(values.investedAmount),
      currentValue: valuation
        ? valuation.currentValue
        : toNumber(values.currentValue || values.investedAmount),
      startDate: goldDetails
        ? goldDetails.purchaseDate
        : debtDetails
          ? debtDetails.startDate
          : (equityDetails?.investmentDate ?? values.startDate),
      notes: values.notes.trim(),
      debtDetails,
      equityDetails,
      goldDetails,
    };
    try {
      if (asset) {
        await updateAsset(asset.id, payload);
        router.push(`/assets/${asset.id}`);
      } else {
        const created = await addAsset(payload);
        router.push(`/assets/${created.id}`);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this asset.",
      );
    }
  }

  return (
    <Card>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {equityKind || debtKind === "bond" || physicalGold ? null : (
          <Field label="Asset name" hint="Example: HDFC Flexi Cap Fund">
            <TextInput
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="What do you call this investment?"
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select
              value={values.categoryId}
              onChange={(e) => {
                const nextCategory = ASSET_CATEGORIES.find(
                  (c) => c.id === e.target.value,
                );
                if (!nextCategory) return;
                const nextType = nextCategory.types[0];
                setValues((prev) => ({
                  ...prev,
                  categoryId: nextCategory.id,
                  type: nextType,
                }));
                setDepositKind("fd");
                switchKinds(nextCategory.id, nextType);
              }}
            >
              {ASSET_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Type">
            <Select
              value={values.type}
              onChange={(e) => {
                set("type", e.target.value);
                setDepositKind("fd");
                switchKinds(values.categoryId, e.target.value);
              }}
            >
              {selectedCategory.types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={institution.label} hint={institution.hint}>
          <TextInput
            value={values.institution}
            onChange={(e) => set("institution", e.target.value)}
            placeholder={institution.placeholder}
          />
        </Field>

        {equityKind ? (
          <EquityFields
            kind={equityKind}
            values={equityValues}
            onPatch={patchEquity}
          />
        ) : physicalGold ? (
          <GoldFields values={goldValues} onPatch={patchGold} />
        ) : debtKind ? (
          <div className="space-y-4">
            {isDepositType(values.type) ? (
              <Field label="Deposit type">
                <Select
                  value={depositKind}
                  onChange={(e) => {
                    const nextKind = e.target.value as DebtKind;
                    setDepositKind(nextKind);
                    switchDebtKind(nextKind);
                  }}
                >
                  <option value="fd">Fixed deposit (one time)</option>
                  <option value="rd">Recurring deposit (every month)</option>
                </Select>
              </Field>
            ) : null}

            <DebtFields
              kind={debtKind}
              values={debtValues}
              onChange={(key, value) =>
                setDebtValues((prev) => ({ ...prev, [key]: value }))
              }
            />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Money you put in (₹)">
                <TextInput
                  type="number"
                  min="0"
                  step="any"
                  value={values.investedAmount}
                  onChange={(e) => set("investedAmount", e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Value today (₹)" hint="Update this anytime">
                <TextInput
                  type="number"
                  min="0"
                  step="any"
                  value={values.currentValue}
                  onChange={(e) => set("currentValue", e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label="Started on">
              <TextInput
                type="date"
                value={values.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </Field>
          </>
        )}

        <Field label="Notes">
          <TextArea
            rows={3}
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder={
              physicalGold
                ? "Gold chain, coins, bangles…"
                : "Anything you want to remember about this asset"
            }
          />
        </Field>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="flex gap-3">
          <Button type="submit">{asset ? "Save changes" : "Add asset"}</Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
