"use client"

import { useMemo, useState } from "react"
import {
    createCoreRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    rowPaginationFeature,
    rowSortingFeature,
    sortFn_basic,
    tableFeatures,
    useTable,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, Download } from "lucide-react"
import { project, type ProjectionPoint } from "@/lib/calculations/financial"
import { compact } from "@/lib/calculations/money"
import { CURRENCY_SYMBOL, useCalculatorStore } from "@/lib/stores/calculator-store"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

/**
 * The ledger: every year of the projection, with its arithmetic shown.
 *
 * This column exists so the headline figure isn't something you take on faith.
 * Principal, interest, tax and the inflation-adjusted balance are laid out year
 * by year, and the export writes the same numbers as CSV so they can be checked
 * in a spreadsheet.
 *
 * Sorting is on because a long horizon gets read from the end backwards — start
 * at the answer, work back to the year it stopped being plausible.
 */

/**
 * Only what this table uses. TanStack v9 makes features opt-in, so filtering,
 * grouping and selection stay out of the bundle rather than shipping unused.
 * `sortFn_basic` covers every column here: they're all numbers.
 */
const FEATURES = tableFeatures({
    rowSortingFeature,
    rowPaginationFeature,
    coreRowModel: createCoreRowModel(),
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    sortFns: { basic: sortFn_basic },
})

export function AuditLedger() {
    const parameters = useCalculatorStore((state) => state.parameters)
    const currencyCode = useCalculatorStore((state) => state.currency)
    const symbol = CURRENCY_SYMBOL[currencyCode]

    const [sorting, setSorting] = useState<SortingState>([])

    const data = useMemo(() => project(parameters), [parameters])

    const columns = useMemo<ColumnDef<typeof FEATURES, ProjectionPoint>[]>(
        () => [
            {
                accessorKey: "year",
                header: "Yr",
                cell: ({ row }) => (
                    <span className="text-muted-foreground">{row.original.year}</span>
                ),
            },
            {
                accessorKey: "contributed",
                header: "Principal",
                cell: ({ row }) => compact(row.original.contributed, symbol),
            },
            {
                accessorKey: "growth",
                header: "Interest",
                cell: ({ row }) => (
                    <span className="text-positive">{compact(row.original.growth, symbol)}</span>
                ),
            },
            {
                accessorKey: "taxIfRealised",
                header: "Tax",
                cell: ({ row }) => (
                    <span className="text-negative">
                        {compact(row.original.taxIfRealised, symbol)}
                    </span>
                ),
            },
            {
                accessorKey: "realBalance",
                header: "Real",
                cell: ({ row }) => (
                    <span className="font-semibold text-foreground">
                        {compact(row.original.realBalance, symbol)}
                    </span>
                ),
            },
        ],
        [symbol]
    )

    const table = useTable({
        features: FEATURES,
        data,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        initialState: { pagination: { pageIndex: 0, pageSize: 12 } },
    })

    const { pageIndex } = table.state.pagination

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Ledger
                </h2>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => exportCsv(data, currencyCode)}
                >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    CSV
                </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((group) => (
                            <TableRow key={group.id} className="hover:bg-transparent">
                                {group.headers.map((header) => {
                                    const sorted = header.column.getIsSorted()
                                    const Icon =
                                        sorted === "asc"
                                            ? ArrowUp
                                            : sorted === "desc"
                                              ? ArrowDown
                                              : ChevronsUpDown
                                    return (
                                        <TableHead key={header.id} className="h-9 px-2">
                                            <button
                                                type="button"
                                                onClick={header.column.getToggleSortingHandler()}
                                                className={cn(
                                                    "inline-flex items-center gap-1 rounded text-[11px] font-bold uppercase tracking-wide",
                                                    "transition-colors hover:text-foreground",
                                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    sorted ? "text-foreground" : "text-muted-foreground"
                                                )}
                                                aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                                            >
                                                <table.FlexRender header={header} />
                                                <Icon className="h-3 w-3" aria-hidden="true" />
                                            </button>
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.map((row, index) => (
                            <TableRow
                                key={row.id}
                                // Zebra striping earns its place on a dense
                                // numeric table: it holds the eye on one year
                                // while reading across five columns.
                                className={cn(index % 2 === 1 && "bg-muted/40")}
                            >
                                {row.getAllCells().map((cell) => (
                                    <TableCell
                                        key={cell.id}
                                        className="figure px-2 py-1.5 text-right text-xs first:text-left"
                                    >
                                        <table.FlexRender cell={cell} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                    Page <span className="figure">{pageIndex + 1}</span> of{" "}
                    <span className="figure">{table.getPageCount()}</span>
                </p>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Back
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
                Interest is cumulative growth above what you paid in. Tax is what would be owed on
                that gain at your marginal rate if you realised it that year — an estimate, not tax
                advice. Real restates the balance in today&rsquo;s money.
            </p>
        </div>
    )
}

/**
 * Exports the whole projection, not the visible page — the point of an export
 * is to be checkable, and half a table isn't. Values go out unrounded and
 * unformatted so a spreadsheet can recompute from them.
 */
function exportCsv(rows: ProjectionPoint[], currencyCode: string) {
    const header = [
        "year",
        `principal_${currencyCode}`,
        `interest_accrued_${currencyCode}`,
        `tax_if_realised_${currencyCode}`,
        `nominal_balance_${currencyCode}`,
        `real_balance_${currencyCode}`,
    ]
    const body = rows.map((row) =>
        [
            row.year,
            row.contributed,
            row.growth,
            row.taxIfRealised,
            row.balance,
            row.realBalance,
        ]
            .map((value) => value.toFixed(2))
            .join(",")
    )

    const blob = new Blob([[header.join(","), ...body].join("\n")], {
        type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "finnacalc-projection.csv"
    link.click()
    URL.revokeObjectURL(url)
}
