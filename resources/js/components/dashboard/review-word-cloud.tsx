import { Link } from '@inertiajs/react';
import {
    BarChart3,
    Cloud,
    Download,
    ExternalLink,
    Search,
    Sparkles,
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import reviewsRoute from '@/routes/reviews';

export interface WordCloudItem {
    text: string;
    value: number;
}

interface ReviewWordCloudProps {
    words: WordCloudItem[];
    allTimeWords?: WordCloudItem[];
    activeMonth?: string | null;
}

interface PlacedWord {
    text: string;
    value: number;
    fontSize: number;
    color: string;
    fontWeight: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

const PALETTE = [
    '#5c6ac4', // slate-purple / indigo (motor)
    '#1e293b', // charcoal dark slate (Pelayanan, dan, sangat)
    '#38bdf8', // sky / light blue (Dealer, Ahass)
    '#f97316', // orange (ramah, Service)
    '#0284c7', // vibrant cyan / blue (cepat, di, Praya)
    '#a8a29e', // warm taupe / stone (bagus)
    '#2563eb', // vivid blue (masbagik, Best, Krida)
    '#ea580c', // red-orange (nyaman, SEKALI, Ruang)
    '#78716c', // grayish brown (beli)
    '#334155', // dark slate (Astra, Honda, bengkel)
    '#e11d48', // rose / pink-red (terbaik)
    '#475569', // slate gray (memuaskan, karyawan)
    '#16a34a', // emerald green (Alhamdulillah, brawijaya, aman)
    '#84cc16', // lime / olive (bima, NSS)
    '#64748b', // cool slate (yg, CS)
    '#d97706', // amber (Adem, maju, Lilik)
    '#ec4899', // pink (cantik, ganti)
    '#9333ea', // purple (Mataram, promo)
    '#0d9488', // teal (rumah, dengan, kopi)
    '#991b1b', // dark red (Motornya)
    '#65a30d', // olive (deh)
    '#9ca3af', // gray (KESINI)
];

const ANCHOR_COLORS: Record<string, string> = {
    motor: '#5c6ac4',
    pelayanan: '#1e293b',
    dan: '#1e293b',
    dealer: '#38bdf8',
    ramah: '#f97316',
    cepat: '#0284c7',
    bagus: '#a8a29e',
    masbagik: '#2563eb',
    nyaman: '#ea580c',
    sangat: '#1e293b',
    di: '#0284c7',
    beli: '#78716c',
    honda: '#334155',
    service: '#f97316',
    servis: '#334155',
    terbaik: '#e11d48',
    memuaskan: '#475569',
    alhamdulillah: '#16a34a',
    bima: '#84cc16',
    yg: '#64748b',
    astra: '#334155',
    best: '#2563eb',
    krida: '#2563eb',
    bengkel: '#334155',
    pelayanannya: '#1e293b',
    praya: '#0284c7',
    mataram: '#9333ea',
    bertais: '#374151',
    sumbawa: '#0284c7',
    gerung: '#475569',
    ampenan: '#38bdf8',
    proses: '#1e293b',
    banyak: '#7c3aed',
    nss: '#84cc16',
    ahass: '#38bdf8',
    sudah: '#f87171',
    ruang: '#ea580c',
    cantik: '#ec4899',
    keren: '#15803d',
    aman: '#16a34a',
    sales: '#581c87',
    kopi: '#0d9488',
    fasilitas: '#475569',
    deler: '#db2777',
    rumah: '#0d9488',
};

function getWordColor(text: string): string {
    const lower = text.toLowerCase();
    if (ANCHOR_COLORS[lower]) {
        return ANCHOR_COLORS[lower];
    }
    let hash = 0;
    for (let i = 0; i < lower.length; i++) {
        hash = (hash << 5) - hash + lower.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % PALETTE.length;
    return PALETTE[idx];
}

function estimateWordWidth(text: string, fontSize: number): number {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if ('mwMW'.includes(char)) width += fontSize * 0.85;
        else if ('ilI1.,!|:; \''.includes(char)) width += fontSize * 0.28;
        else if ('fjrt'.includes(char)) width += fontSize * 0.42;
        else if (char === char.toUpperCase() && char !== char.toLowerCase()) width += fontSize * 0.72;
        else width += fontSize * 0.56;
    }
    return width + 6;
}

export function ReviewWordCloud({
    words = [],
    allTimeWords = [],
    activeMonth = null,
}: ReviewWordCloudProps) {
    const [periodMode, setPeriodMode] = React.useState<'active' | 'all'>('all');
    const [viewMode, setViewMode] = React.useState<'cloud' | 'table'>('cloud');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [hoveredWord, setHoveredWord] = React.useState<PlacedWord | null>(null);

    const activeList = React.useMemo(() => {
        if (periodMode === 'active' && words.length > 0) {
            return words;
        }
        if (allTimeWords.length > 0) {
            return allTimeWords;
        }
        return words;
    }, [periodMode, words, allTimeWords]);

    const filteredWords = React.useMemo(() => {
        if (!searchQuery.trim()) return activeList;
        const q = searchQuery.toLowerCase().trim();
        return activeList.filter((w) => w.text.toLowerCase().includes(q));
    }, [activeList, searchQuery]);

    // Word Cloud Layout computation
    const placedWords: PlacedWord[] = React.useMemo(() => {
        if (filteredWords.length === 0) return [];

        const WIDTH = 1000;
        const HEIGHT = 380;
        const centerX = WIDTH / 2;
        const centerY = HEIGHT / 2;

        const maxVal = Math.max(...filteredWords.map((w) => w.value), 1);
        const minVal = Math.min(...filteredWords.map((w) => w.value), 1);
        const range = Math.max(maxVal - minVal, 1);

        const sorted = [...filteredWords].sort((a, b) => b.value - a.value).slice(0, 140);

        const placedBoxes: { x1: number; y1: number; x2: number; y2: number }[] = [];
        const result: PlacedWord[] = [];

        const intersects = (
            x1: number,
            y1: number,
            x2: number,
            y2: number,
            padding = 3
        ) => {
            for (const b of placedBoxes) {
                if (
                    !(
                        x2 + padding < b.x1 ||
                        x1 - padding > b.x2 ||
                        y2 + padding < b.y1 ||
                        y1 - padding > b.y2
                    )
                ) {
                    return true;
                }
            }
            return false;
        };

        for (const item of sorted) {
            const t = (item.value - minVal) / range;
            // Power curve: high frequency stands out (up to 48px), lower frequency remains crisp (11px-16px)
            let fontSize = Math.round(11 + Math.pow(t, 0.6) * 37);

            // Give extra weight to words like 'motor' or top 3 words
            const fontWeight = fontSize >= 32 ? 700 : fontSize >= 22 ? 600 : 500;
            const color = getWordColor(item.text);

            let placed = false;
            let currentWidth = estimateWordWidth(item.text, fontSize);
            let currentHeight = fontSize * 1.15;

            // Spiral parameters: horizontal stretch factor ~2.1
            const spiralStep = 2.2;
            const maxSpiralSteps = 450;
            const angleDelta = 0.16;

            for (let step = 0; step < maxSpiralSteps; step++) {
                const angle = step * angleDelta;
                const radius = spiralStep * angle;
                const x = centerX + radius * Math.cos(angle) * 2.1;
                const y = centerY + radius * Math.sin(angle);

                const halfW = currentWidth / 2;
                const halfH = currentHeight / 2;
                const x1 = x - halfW;
                const y1 = y - halfH;
                const x2 = x + halfW;
                const y2 = y + halfH;

                // Ensure within SVG canvas
                if (x1 >= 10 && x2 <= WIDTH - 10 && y1 >= 10 && y2 <= HEIGHT - 10) {
                    if (!intersects(x1, y1, x2, y2, 3)) {
                        placedBoxes.push({ x1, y1, x2, y2 });
                        result.push({
                            text: item.text,
                            value: item.value,
                            fontSize,
                            color,
                            fontWeight,
                            x,
                            y: y + fontSize * 0.35, // SVG text baseline adjustment
                            width: currentWidth,
                            height: currentHeight,
                        });
                        placed = true;
                        break;
                    }
                }
            }

            // Fallback: If not placed, try smaller size once
            if (!placed && fontSize > 14) {
                fontSize = Math.round(fontSize * 0.75);
                currentWidth = estimateWordWidth(item.text, fontSize);
                currentHeight = fontSize * 1.15;

                for (let step = 0; step < 200; step++) {
                    const angle = step * 0.2;
                    const radius = 2.0 * angle;
                    const x = centerX + radius * Math.cos(angle) * 2.2;
                    const y = centerY + radius * Math.sin(angle);

                    const halfW = currentWidth / 2;
                    const halfH = currentHeight / 2;
                    const x1 = x - halfW;
                    const y1 = y - halfH;
                    const x2 = x + halfW;
                    const y2 = y + halfH;

                    if (x1 >= 10 && x2 <= WIDTH - 10 && y1 >= 10 && y2 <= HEIGHT - 10) {
                        if (!intersects(x1, y1, x2, y2, 2)) {
                            placedBoxes.push({ x1, y1, x2, y2 });
                            result.push({
                                text: item.text,
                                value: item.value,
                                fontSize,
                                color,
                                fontWeight,
                                x,
                                y: y + fontSize * 0.35,
                                width: currentWidth,
                                height: currentHeight,
                            });
                            break;
                        }
                    }
                }
            }
        }

        return result;
    }, [filteredWords]);

    const handleExportCsv = () => {
        const rows = [
            ['NO', 'KATA / FRASA', 'FREKUENSI (KEMUNCULAN)'],
            ...activeList.map((w, i) => [i + 1, `"${w.text.replace(/"/g, '""')}"`, w.value]),
        ];
        const csvContent = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Review_Word_Cloud_${periodMode}_${activeMonth || 'all'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Card className="flex flex-col border shadow-sm overflow-hidden bg-background">
            {/* Top Green Banner - Exact Match to Screenshot */}
            <div className="py-2 px-4 text-center select-none shadow-xs">
                <h3 className="text-black bold text-sm sm:text-base font-bold tracking-wider uppercase font-sans">
                    REVIEW TEXT
                </h3>
            </div>

            {/* Sub-toolbar Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2 border-b bg-muted/20 text-xs">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        Frekuensi Kata Ulasan
                    </span>
                    <Badge variant="secondary" className="text-[11px] font-semibold">
                        {activeList.length} Kata Terdeteksi
                    </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Search in Cloud */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cari kata..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-7 w-32 sm:w-40 rounded border bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer text-xs"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {/* Period Switcher */}
                    {allTimeWords.length > 0 && words.length > 0 && activeMonth && (
                        <div className="flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
                            <button
                                type="button"
                                onClick={() => setPeriodMode('all')}
                                className={`rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                                    periodMode === 'all'
                                        ? 'bg-background shadow-xs text-foreground font-semibold'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Semua Waktu
                            </button>
                            <button
                                type="button"
                                onClick={() => setPeriodMode('active')}
                                className={`rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                                    periodMode === 'active'
                                        ? 'bg-background shadow-xs text-foreground font-semibold'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Bulan Ini ({activeMonth})
                            </button>
                        </div>
                    )}

                    {/* View Mode Toggle */}
                    <div className="flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('cloud')}
                            className={`flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                                viewMode === 'cloud'
                                    ? 'bg-background shadow-xs text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Tampilan Word Cloud"
                        >
                            <Cloud className="size-3" />
                            <span className="hidden sm:inline">Cloud</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                                viewMode === 'table'
                                    ? 'bg-background shadow-xs text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Tampilan Tabel Frekuensi"
                        >
                            <BarChart3 className="size-3" />
                            <span className="hidden sm:inline">Tabel</span>
                        </button>
                    </div>

                    {/* Export CSV */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCsv}
                        className="h-7 px-2 text-xs gap-1 cursor-pointer"
                        title="Export Frekuensi Kata CSV"
                    >
                        <Download className="size-3" />
                        <span className="hidden md:inline">Export</span>
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <CardContent className="p-0 relative flex-1 min-h-[380px] bg-white dark:bg-card">
                {viewMode === 'cloud' ? (
                    <div className="relative w-full overflow-hidden select-none py-2 px-1">
                        {placedWords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-muted-foreground min-h-[360px]">
                                <Cloud className="size-10 text-muted-foreground/40 mb-2" />
                                <p className="font-semibold text-foreground">Tidak Ada Kata Ulasan</p>
                                <p className="mt-1">Belum ada data ulasan teks yang dapat dianalisis untuk periode ini.</p>
                            </div>
                        ) : (
                            <div className="relative w-full">
                                <svg
                                    viewBox="0 0 1000 380"
                                    className="w-full h-auto max-h-[440px] drop-shadow-2xs"
                                    style={{ fontFeatureSettings: '"tnum"' }}
                                >
                                    {placedWords.map((word) => {
                                        const isHovered = hoveredWord?.text === word.text;
                                        const isMatchingSearch =
                                            searchQuery.trim() !== '' &&
                                            word.text.toLowerCase().includes(searchQuery.toLowerCase());

                                        return (
                                            <g
                                                key={word.text}
                                                className="cursor-pointer transition-all duration-150"
                                                onMouseEnter={() => setHoveredWord(word)}
                                                onMouseLeave={() => setHoveredWord(null)}
                                            >
                                                {/* Text element */}
                                                <text
                                                    x={word.x}
                                                    y={word.y}
                                                    textAnchor="middle"
                                                    fill={word.color}
                                                    fontSize={word.fontSize}
                                                    fontWeight={word.fontWeight}
                                                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                                                    opacity={
                                                        searchQuery.trim() === ''
                                                            ? isHovered
                                                                ? 1
                                                                : hoveredWord
                                                                ? 0.45
                                                                : 0.95
                                                            : isMatchingSearch
                                                            ? 1
                                                            : 0.25
                                                    }
                                                    style={{
                                                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                                                        transformOrigin: `${word.x}px ${word.y}px`,
                                                        transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                                                    }}
                                                >
                                                    {word.text}
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* Interactive Hover Tooltip - Matching Image 2 */}
                                    {hoveredWord && (
                                        <g
                                            className="pointer-events-none transition-all duration-150"
                                            transform={`translate(${hoveredWord.x}, ${hoveredWord.y - hoveredWord.height / 2})`}
                                        >
                                            {/* Tooltip Box Container */}
                                            <g transform="translate(-85, -54)">
                                                {/* Shadow & Background Box */}
                                                <rect
                                                    width={170}
                                                    height={46}
                                                    rx={4}
                                                    fill="#2b3044"
                                                    filter="drop-shadow(0px 6px 12px rgba(0,0,0,0.35))"
                                                />
                                                {/* Tooltip Arrow / Caret */}
                                                <polygon
                                                    points="80,46 90,46 85,52"
                                                    fill="#2b3044"
                                                />
                                                {/* Tooltip Text: word on left, count on right */}
                                                <text
                                                    x={22}
                                                    y={28}
                                                    fill="#f1f5f9"
                                                    fontSize={15}
                                                    fontWeight={500}
                                                    fontFamily="system-ui, -apple-system, sans-serif"
                                                >
                                                    {hoveredWord.text.length > 9
                                                        ? hoveredWord.text.slice(0, 8) + '…'
                                                        : hoveredWord.text}
                                                </text>
                                                <text
                                                    x={148}
                                                    y={28}
                                                    textAnchor="end"
                                                    fill="#ffffff"
                                                    fontSize={15}
                                                    fontWeight={700}
                                                    fontFamily="system-ui, -apple-system, sans-serif"
                                                >
                                                    {hoveredWord.value.toLocaleString('id-ID')}
                                                </text>
                                            </g>
                                        </g>
                                    )}
                                </svg>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Table View Mode */
                    <div className="p-4 overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[11px]">
                                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                                    <th className="py-2.5 px-3">Kata / Frasa Ulasan</th>
                                    <th className="py-2.5 px-3 text-right">Frekuensi Muncul</th>
                                    <th className="py-2.5 px-3 text-center w-28">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredWords.map((item, index) => (
                                    <tr key={item.text} className="hover:bg-muted/30 transition-colors">
                                        <td className="py-2 px-3 text-center text-muted-foreground font-mono">
                                            {index + 1}
                                        </td>
                                        <td className="py-2 px-3 font-medium text-foreground">
                                            <span
                                                className="inline-block px-2 py-0.5 rounded font-semibold text-xs"
                                                style={{
                                                    color: getWordColor(item.text),
                                                    backgroundColor: `${getWordColor(item.text)}15`,
                                                }}
                                            >
                                                {item.text}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-foreground font-mono">
                                            {item.value.toLocaleString('id-ID')}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                asChild
                                                className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary"
                                            >
                                                <Link href={reviewsRoute.index.url({ query: { search: item.text } })}>
                                                    Lihat <ExternalLink className="size-3" />
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
export default ReviewWordCloud;
