import React, { useEffect, useState } from "react";
import { Button } from "@mui/material";

const LOCALE_KEY = "queens_match_locale";

function readLocale() {
  return localStorage.getItem(LOCALE_KEY) === "he" ? "he" : "en";
}

function applyLocale(locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
}

export default function LocaleToggle({ sx }) {
  const [locale, setLocale] = useState(readLocale);

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  const toggleLocale = () => {
    const nextLocale = locale === "en" ? "he" : "en";
    localStorage.setItem(LOCALE_KEY, nextLocale);
    setLocale(nextLocale);
  };

  return (
    <Button onClick={toggleLocale} aria-label="Switch language" sx={sx}>
      {locale === "en" ? "HE" : "EN"}
    </Button>
  );
}
