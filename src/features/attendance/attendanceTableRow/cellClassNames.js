export function cellClsForGrid(virtual, s, minimal = false) {
  if (!virtual) return s;
  if (minimal) {
    let out = s
      .replace(
        /hidden md:table-cell/g,
        "flex min-w-0 items-center justify-center",
      )
      .replace(
        /hidden lg:table-cell/g,
        "flex min-w-0 items-center justify-center",
      )
      .replace(
        /hidden xl:table-cell/g,
        "flex min-w-0 items-center justify-center",
      )
      .trim();
    if (out.includes("text-left md:text-center")) {
      out = `${out} flex items-center justify-start md:justify-center`;
    } else if (/\btext-center\b/.test(out) && !out.includes("justify-")) {
      out = `${out} flex items-center justify-center`;
    } else if (!/\bflex\b/.test(out)) {
      out = `${out} flex items-center`;
    }
    return `${out} min-w-0`;
  }
  let out = s
    .replace(
      /hidden md:table-cell/g,
      "hidden md:flex md:items-center md:justify-center",
    )
    .replace(
      /hidden lg:table-cell/g,
      "hidden lg:flex lg:items-center lg:justify-center",
    )
    .replace(
      /hidden xl:table-cell/g,
      "hidden xl:flex xl:items-center xl:justify-center",
    )
    .trim();
  if (out.includes("text-left md:text-center")) {
    out = `${out} flex items-center justify-start md:justify-center`;
  } else if (/\btext-center\b/.test(out) && !out.includes("justify-")) {
    out = `${out} flex items-center justify-center`;
  } else if (!/\bflex\b/.test(out)) {
    out = `${out} flex items-center`;
  }
  return `${out} min-w-0`;
}

