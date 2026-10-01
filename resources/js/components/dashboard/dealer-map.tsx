import type * as LTypes from 'leaflet';
import 'leaflet/dist/leaflet.css';

let L: typeof LTypes | null = null;
import {
    Building2,
    Check,
    ChevronDown,
    ExternalLink,
    Layers,
    MapPin,
    Maximize2,
    MessageSquare,
    Minimize2,
    Palette,
    Phone,
    RotateCcw,
    Search,
    Star,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Modal as AntModal, Tag as AntTag, Tooltip as AntTooltip } from 'antd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import reviewsRoute from '@/routes/reviews';

export interface DealerStarRecap {
    stars: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
    };
    total_system_reviews: number;
    total_maps_reviews: number;
    responded_count: number;
    response_rate: number;
    positive_reviews: number;
    neutral_reviews: number;
    critical_reviews: number;
}

export interface MapDealer {
    id: number;
    kode_dealer: string;
    nama_dealer: string;
    latitude: number;
    longitude: number;
    alamat: string | null;
    kelurahan: string | null;
    kecamatan: string | null;
    pos_code: string | null;
    no_telp_showroom: string | null;
    star_rate: number | null;
    total_review: number;
    link_google_maps: string | null;
    recap: DealerStarRecap;
}

export interface DealerMapProps {
    dealers: MapDealer[];
    selectedDealerId?: string;
    onSelectDealer?: (dealerId: string) => void;
    className?: string;
}

export type MapTileStyle = 'streets' | 'dataviz' | 'hybrid' | 'dark' | 'basic' | 'outdoor';
export type MapPinStyle = 'capsule' | 'teardrop' | 'badge';

export const MAPTILER_ATTRIBUTION =
    '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';

export const MAP_STYLES: Record<
    MapTileStyle,
    {
        name: string;
        icon: string;
        description: string;
        mapId: string;
        format: 'png' | 'jpg';
        maxZoom: number;
    }
> = {
    streets: {
        name: 'MapTiler Streets (Modern)',
        icon: '🗺️',
        description: 'Peta modern jernih & bersih ala Google Maps',
        mapId: 'streets-v2',
        format: 'png',
        maxZoom: 20,
    },
    dataviz: {
        name: 'MapTiler DataViz (Terang)',
        icon: '⚪',
        description: 'Gaya monokrom terang minimalis untuk dashboard analitik',
        mapId: 'dataviz-light',
        format: 'png',
        maxZoom: 20,
    },
    hybrid: {
        name: 'MapTiler Hybrid (Satelit)',
        icon: '🛰️',
        description: 'Citra foto satelit resolusi tinggi dengan label jalan',
        mapId: 'hybrid',
        format: 'jpg',
        maxZoom: 20,
    },
    dark: {
        name: 'MapTiler DataViz (Dark Mode)',
        icon: '🌙',
        description: 'Tema gelap kontras tinggi untuk dashboard malam hari',
        mapId: 'dataviz-dark',
        format: 'png',
        maxZoom: 20,
    },
    basic: {
        name: 'MapTiler Basic',
        icon: '📍',
        description: 'Peta esensial bersih dengan kontur minimal',
        mapId: 'basic-v2',
        format: 'png',
        maxZoom: 20,
    },
    outdoor: {
        name: 'MapTiler Outdoor',
        icon: '🏔️',
        description: 'Peta kontur topografi dan alam terbuka',
        mapId: 'outdoor-v2',
        format: 'png',
        maxZoom: 20,
    },
};

// 1. Kapsul Modern (Default) - Sleek pill with Honda Wing + Star Rating
function createCapsulePin(dealer: MapDealer, isSelected: boolean): LTypes.DivIcon | null {
    if (!L) return null;
    const leaflet = L;

    const rating = dealer.star_rate !== null && dealer.star_rate !== undefined
        ? dealer.star_rate.toFixed(1)
        : '-';

    const isHigh = (dealer.star_rate ?? 0) >= 4.8;
    const accentColor = isSelected ? '#2563eb' : isHigh ? '#dc2626' : '#ea580c';

    return leaflet.divIcon({
        className: 'dealer-marker-div-icon',
        html: `
            <div class="dealer-pin-node cursor-pointer" style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.28)); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">
                <div style="
                    display: inline-flex;
                    align-items: center;
                    background: #ffffff;
                    border-radius: 9999px;
                    padding: 2.5px 7px 2.5px 4px;
                    border: 2px solid ${accentColor};
                    box-shadow: ${isSelected ? '0 0 0 3.5px rgba(37,99,235,0.45)' : 'none'};
                    gap: 5px;
                    white-space: nowrap;
                ">
                    <!-- Honda Logo Cropped to Wing -->
                    <div style="width: 22px; height: 16px; overflow: hidden; display: flex; align-items: flex-start; justify-content: center; flex-shrink: 0;">
                        <img src="/pinpoint-icon.png" alt="Honda" style="width: 26px; height: 26px; object-fit: contain; object-position: top center; display: block;" />
                    </div>
                    <!-- Rating Badge -->
                    <div style="display: flex; align-items: center; gap: 2px; font-weight: 700; font-size: 11px; color: #0f172a; font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1;">
                        <span style="color: #eab308; font-size: 10px;">★</span>
                        <span>${rating}</span>
                    </div>
                </div>
                <!-- Needle Triangle -->
                <div style="
                    width: 0;
                    height: 0;
                    border-left: 5px solid transparent;
                    border-right: 5px solid transparent;
                    border-top: 6px solid ${accentColor};
                    margin-top: -1px;
                "></div>
            </div>
        `,
        iconSize: [62, 30],
        iconAnchor: [31, 30],
        popupAnchor: [0, -5],
        tooltipAnchor: [0, -15],
    });
}

// 2. Teardrop Pin - Google Maps style pin
function createTeardropPin(dealer: MapDealer, isSelected: boolean): LTypes.DivIcon | null {
    if (!L) return null;
    const leaflet = L;

    const rating = dealer.star_rate !== null && dealer.star_rate !== undefined
        ? dealer.star_rate.toFixed(1)
        : '-';

    const isHigh = (dealer.star_rate ?? 0) >= 4.8;
    const pinColor = isSelected ? '#2563eb' : isHigh ? '#dc2626' : '#ea580c';

    return leaflet.divIcon({
        className: 'dealer-marker-div-icon',
        html: `
            <div class="dealer-pin-node cursor-pointer" style="position: relative; width: 34px; height: 44px; display: flex; justify-content: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35)); transition: transform 0.2s ease;">
                <div style="
                    position: absolute;
                    width: 32px;
                    height: 32px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    background: ${pinColor};
                    border: 2px solid #ffffff;
                    top: 0;
                    left: 1px;
                    box-shadow: ${isSelected ? '0 0 0 3px rgba(37,99,235,0.45)' : 'none'};
                "></div>
                <div style="
                    position: absolute;
                    width: 20px;
                    height: 20px;
                    background: #ffffff;
                    border-radius: 50%;
                    top: 6px;
                    left: 7px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                ">
                    <img src="/pinpoint-icon.png" alt="Honda" style="width: 22px; height: 22px; object-fit: contain; object-position: top center;" />
                </div>
                <div style="
                    position: absolute;
                    top: -5px;
                    right: -14px;
                    background: #0f172a;
                    color: #ffffff;
                    font-size: 9px;
                    font-weight: 700;
                    padding: 1px 4px;
                    border-radius: 9999px;
                    border: 1px solid rgba(255,255,255,0.4);
                    display: flex;
                    align-items: center;
                    gap: 1.5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.25);
                    line-height: 1;
                    white-space: nowrap;
                ">
                    <span style="color: #fbbf24; font-size: 8px;">★</span>
                    <span>${rating}</span>
                </div>
            </div>
        `,
        iconSize: [34, 44],
        iconAnchor: [17, 44],
        popupAnchor: [0, -10],
        tooltipAnchor: [0, -22],
    });
}

// 3. Clean Badge Pin - Neat rectangular badge with no text cut-off
function createBadgePin(dealer: MapDealer, isSelected: boolean): LTypes.DivIcon | null {
    if (!L) return null;
    const leaflet = L;

    const rating = dealer.star_rate !== null && dealer.star_rate !== undefined
        ? dealer.star_rate.toFixed(1)
        : '-';

    const isHigh = (dealer.star_rate ?? 0) >= 4.8;
    const borderColor = isSelected ? '#2563eb' : isHigh ? '#dc2626' : '#ea580c';

    return leaflet.divIcon({
        className: 'dealer-marker-div-icon',
        html: `
            <div class="dealer-pin-node cursor-pointer" style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.3)); transition: transform 0.2s ease;">
                <div style="
                    background: #ffffff;
                    border-radius: 7px;
                    border: 2px solid ${borderColor};
                    padding: 3px 6px;
                    box-shadow: ${isSelected ? '0 0 0 3px rgba(37,99,235,0.45)' : 'none'};
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    min-width: 48px;
                ">
                    <div style="width: 32px; height: 16px; overflow: hidden; display: flex; align-items: flex-start; justify-content: center;">
                        <img src="/pinpoint-icon.png" alt="Honda" style="width: 32px; height: 32px; object-fit: contain; object-position: top center;" />
                    </div>
                    <div style="
                        margin-top: 2px;
                        background: ${isHigh ? '#059669' : '#d97706'};
                        color: #ffffff;
                        font-size: 9px;
                        font-weight: 700;
                        padding: 1px 5px;
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        gap: 2px;
                        line-height: 1;
                    ">
                        <span>★</span><span>${rating}</span>
                    </div>
                </div>
                <div style="
                    width: 0;
                    height: 0;
                    border-left: 5px solid transparent;
                    border-right: 5px solid transparent;
                    border-top: 6px solid ${borderColor};
                    margin-top: -1px;
                "></div>
            </div>
        `,
        iconSize: [52, 44],
        iconAnchor: [26, 43],
        popupAnchor: [0, -5],
        tooltipAnchor: [0, -20],
    });
}

// Master DivIcon generator supporting chosen pin style
function createDealerPinIcon(dealer: MapDealer, isSelected: boolean, pinStyle: MapPinStyle = 'capsule'): LTypes.DivIcon | null {
    if (!L) return null;
    if (pinStyle === 'teardrop') {
        return createTeardropPin(dealer, isSelected);
    }
    if (pinStyle === 'badge') {
        return createBadgePin(dealer, isSelected);
    }
    return createCapsulePin(dealer, isSelected);
}

// Generate the rich HTML card displayed on click
function buildDealerPopupHtml(dealer: MapDealer): string {
    const recap = dealer.recap || {
        stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        total_system_reviews: 0,
        total_maps_reviews: 0,
        responded_count: 0,
        response_rate: 0,
        positive_reviews: 0,
        neutral_reviews: 0,
        critical_reviews: 0,
    };
    const totalReviews = recap.total_system_reviews || recap.total_maps_reviews || 1;

    // Build star distribution bars
    const starBarsHtml = [5, 4, 3, 2, 1]
        .map((star) => {
            const count = recap.stars[star as keyof typeof recap.stars] || 0;
            const pct = Math.round((count / totalReviews) * 100);
            const color =
                star >= 4 ? '#10b981' : star === 3 ? '#f59e0b' : '#f43f5e';

            return `
                <div style="display: flex; align-items: center; gap: 5px; font-size: 10px; margin-bottom: 2px;">
                    <span style="width: 14px; font-weight: 600; color: #4b5563;">${star}★</span>
                    <div style="flex: 1; height: 4px; background-color: #e5e7eb; border-radius: 9999px; overflow: hidden;">
                        <div style="height: 100%; width: ${pct}%; background-color: ${color}; border-radius: 9999px;"></div>
                    </div>
                    <span style="width: 38px; text-align: right; font-family: monospace; color: #6b7280; font-size: 9.5px;">
                        ${count} <span style="font-size: 8.5px; opacity: 0.8;">(${pct}%)</span>
                    </span>
                </div>
            `;
        })
        .join('');

    const phoneDisplay = dealer.no_telp_showroom
        ? `<div style="display: flex; align-items: center; gap: 5px; font-size: 11px; margin-top: 4px;">
            <span>📞</span>
            <a href="tel:${dealer.no_telp_showroom}" style="color: #2563eb; font-weight: 600; text-decoration: none;">${dealer.no_telp_showroom}</a>
          </div>`
        : `<div style="font-size: 10.5px; color: #9ca3af; font-style: italic; margin-top: 4px;">
            📞 No. Telp belum tercatat
          </div>`;

    const addressParts = [
        dealer.alamat,
        dealer.kelurahan ? `Kel. ${dealer.kelurahan}` : null,
        dealer.kecamatan ? `Kec. ${dealer.kecamatan}` : null,
        dealer.pos_code ? `Kode Pos ${dealer.pos_code}` : null,
    ].filter(Boolean);

    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Alamat belum tercatat';

    const tagsHtml = [
        dealer.kelurahan ? `<span style="background: #f3f4f6; color: #374151; padding: 1px 5px; border-radius: 3px; font-size: 9.5px;">Kel. ${dealer.kelurahan}</span>` : '',
        dealer.kecamatan ? `<span style="background: #f3f4f6; color: #374151; padding: 1px 5px; border-radius: 3px; font-size: 9.5px;">Kec. ${dealer.kecamatan}</span>` : '',
        dealer.pos_code ? `<span style="background: #eff6ff; color: #1e40af; padding: 1px 5px; border-radius: 3px; font-size: 9.5px; font-family: monospace;">📮 ${dealer.pos_code}</span>` : '',
    ].filter(Boolean).join(' ');

    const mapsBtn = dealer.link_google_maps
        ? `<a href="${dealer.link_google_maps}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; font-size: 10.5px; font-weight: 600; color: #2563eb; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 5px; text-decoration: none;">
            <span>Maps ↗</span>
           </a>`
        : '';

    const reviewUrl = reviewsRoute.index.url({ query: { dealer_id: dealer.id } });

    return `
        <div class="dealer-map-popup-card" style="width: 295px; font-family: ui-sans-serif, system-ui, sans-serif; text-align: left; padding: 10px 12px; background: #ffffff; border-radius: 10px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; color: #111827; line-height: 1.35;">
            <!-- Header Showroom with logo & close button padding -->
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; border-bottom: 1px solid #f3f4f6; padding-bottom: 7px; margin-bottom: 7px; padding-right: 24px;">
                <div style="display: flex; align-items: flex-start; gap: 7px; min-width: 0; flex: 1;">
                    <img src="/pinpoint-icon.png" alt="Honda" style="height: 18px; width: auto; object-fit: contain; flex-shrink: 0; margin-top: 1px;" />
                    <div style="min-width: 0; flex: 1;">
                        <div style="font-size: 9px; font-weight: 700; color: #dc2626; text-transform: uppercase;">${dealer.kode_dealer}</div>
                        <div style="font-size: 12px; font-weight: 700; color: #111827; line-height: 1.3; word-break: break-word; overflow-wrap: break-word;">${dealer.nama_dealer}</div>
                    </div>
                </div>
                <div style="display: inline-flex; align-items: center; gap: 2px; background-color: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 9999px; font-weight: 700; font-size: 11px; flex-shrink: 0; margin-top: 1px;">
                    <span>★</span>
                    <span>${dealer.star_rate !== null ? dealer.star_rate.toFixed(1) : '-'}</span>
                </div>
            </div>

            <!-- Kontak Showroom -->
            ${phoneDisplay}

            <!-- Alamat Lengkap & Tags -->
            <div style="margin-top: 5px; margin-bottom: 6px; background-color: #f9fafb; padding: 6px 8px; border-radius: 6px; border: 1px solid #f3f4f6;">
                <div style="font-size: 10px; color: #4b5563; line-height: 1.3;">
                    📍 ${fullAddress}
                </div>
                ${tagsHtml ? `<div style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px;">${tagsHtml}</div>` : ''}
            </div>

            <!-- Recap Star Review -->
            <div style="border-top: 1px solid #f3f4f6; padding-top: 5px; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
                    <span style="font-size: 10.5px; font-weight: 700; color: #374151;">Rekap Star Review</span>
                    <span style="font-size: 10px; color: #6b7280;">Total: <strong>${recap.total_maps_reviews || recap.total_system_reviews}</strong></span>
                </div>
                <div style="padding: 2px 0;">
                    ${starBarsHtml}
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9.5px; color: #6b7280; background: #f9fafb; padding: 3px 6px; border-radius: 4px; margin-top: 3px;">
                    <span>Respons: <strong style="color: #059669;">${recap.response_rate}%</strong></span>
                    <span>Dijawab: <strong style="color: #111827;">${recap.responded_count}</strong></span>
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; border-top: 1px solid #f3f4f6; padding-top: 6px;">
                <a href="${reviewUrl}" style="display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; font-size: 10.5px; font-weight: 600; color: #111827; background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 5px; text-decoration: none;">
                    <span>Lihat Ulasan →</span>
                </a>
                ${mapsBtn}
            </div>
        </div>
    `;
}

export default function DealerMap({
    dealers,
    selectedDealerId,
    onSelectDealer,
    className = '',
}: DealerMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<LTypes.Map | null>(null);
    const markersLayerRef = useRef<LTypes.LayerGroup | null>(null);
    const tileLayerRef = useRef<LTypes.TileLayer | null>(null);

    const [isLeafletReady, setIsLeafletReady] = useState(() => L !== null);

    useEffect(() => {
        let isCancelled = false;
        if (typeof window === 'undefined') return;

        if (L) {
            setIsLeafletReady(true);
            return;
        }

        import('leaflet').then((leafletModule) => {
            L = (leafletModule.default || leafletModule) as typeof LTypes;
            if (!isCancelled) {
                setIsLeafletReady(true);
            }
        });

        return () => {
            isCancelled = true;
        };
    }, []);

    // Map style & Pin design with local storage persistence
    const [mapStyle, setMapStyle] = useState<MapTileStyle>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('honda_dealer_map_style') as MapTileStyle;
            if (saved && MAP_STYLES[saved]) return saved;
        }
        return 'streets';
    });

    const [pinStyle, setPinStyle] = useState<MapPinStyle>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('honda_dealer_map_pin_style') as MapPinStyle;
            if (saved && ['capsule', 'teardrop', 'badge'].includes(saved)) return saved;
        }
        return 'capsule';
    });

    const page = usePage<{ maptilerApiKey?: string }>();
    // MapTiler API Key loaded with multi-layer fallback: Inertia shared props, .env, or developer default
    const apiKey = (
        page.props.maptilerApiKey ||
        (import.meta.env.VITE_MAPTILER_API_KEY as string | undefined) ||
        'Ky456DhoOJH2nIXinbxJ'
    ).trim();

    const [showStyleModal, setShowStyleModal] = useState(false);

    const handleSelectMapStyle = (style: MapTileStyle) => {
        setMapStyle(style);
        try {
            localStorage.setItem('honda_dealer_map_style', style);
        } catch {
            // ignore storage quota errors
        }
    };

    const handleSelectPinStyle = (style: MapPinStyle) => {
        setPinStyle(style);
        try {
            localStorage.setItem('honda_dealer_map_pin_style', style);
        } catch {
            // ignore storage quota errors
        }
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [ratingFilter, setRatingFilter] = useState<'all' | 'high' | 'attention'>('all');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [activeDealer, setActiveDealer] = useState<MapDealer | null>(null);

    // Filter dealers based on search and rating
    const filteredDealers = useMemo(() => {
        return dealers.filter((d) => {
            const matchesSearch =
                !searchQuery ||
                d.nama_dealer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.kode_dealer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (d.alamat && d.alamat.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (d.kecamatan && d.kecamatan.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (d.kelurahan && d.kelurahan.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (ratingFilter === 'high') {
                return (d.star_rate ?? 0) >= 4.8;
            }
            if (ratingFilter === 'attention') {
                return (d.star_rate ?? 0) < 4.8;
            }

            return true;
        });
    }, [dealers, searchQuery, ratingFilter]);

    // Helper to generate tile URL & config using MapTiler raster endpoint
    const getTileConfig = (style: MapTileStyle, key: string) => {
        const cfg = MAP_STYLES[style] || MAP_STYLES.streets;
        const cleanKey = key.trim();

        if (cleanKey) {
            return {
                url: `https://api.maptiler.com/maps/${cfg.mapId}/256/{z}/{x}/{y}.${cfg.format}?key=${encodeURIComponent(cleanKey)}`,
                maxZoom: cfg.maxZoom,
            };
        }

        // Graceful fallback when key is not provided yet so user doesn't see broken 403 tiles
        return {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            maxZoom: 19,
        };
    };

    // Initialize Map Instance
    useEffect(() => {
        if (!isLeafletReady || !L || !mapContainerRef.current || mapInstanceRef.current) return;
        const leaflet = L;

        // Default center on Lombok / NTB
        const map = leaflet.map(mapContainerRef.current, {
            center: [-8.65, 117.3],
            zoom: 9,
            zoomControl: false,
            attributionControl: false,
        });

        // Add Zoom Control to top-right
        leaflet.control.zoom({ position: 'topright' }).addTo(map);

        // Add Active MapTiler Tile Layer
        const tileConfig = getTileConfig(mapStyle, apiKey);
        const initialTile = leaflet.tileLayer(tileConfig.url, {
            maxZoom: tileConfig.maxZoom,
            attribution: MAPTILER_ATTRIBUTION,
            crossOrigin: true,
        }).addTo(map);
        initialTile.bringToBack();
        tileLayerRef.current = initialTile;

        // Create marker group
        const markersLayer = leaflet.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapInstanceRef.current = map;

        return () => {
            map.remove();
            mapInstanceRef.current = null;
            markersLayerRef.current = null;
            tileLayerRef.current = null;
        };
    }, [isLeafletReady]);

    // Switch Tile Layer dynamically when mapStyle or apiKey changes
    useEffect(() => {
        if (!isLeafletReady || !L) return;
        const map = mapInstanceRef.current;
        if (!map) return;
        const leaflet = L;

        const tileConfig = getTileConfig(mapStyle, apiKey);

        if (tileLayerRef.current && map.hasLayer(tileLayerRef.current)) {
            tileLayerRef.current.setUrl(tileConfig.url);
            tileLayerRef.current.options.maxZoom = tileConfig.maxZoom;
        } else {
            // Remove any old tile layers to prevent overlap
            map.eachLayer((layer) => {
                if (layer instanceof leaflet.TileLayer) {
                    map.removeLayer(layer);
                }
            });

            const newTile = leaflet.tileLayer(tileConfig.url, {
                maxZoom: tileConfig.maxZoom,
                attribution: MAPTILER_ATTRIBUTION,
                crossOrigin: true,
            }).addTo(map);
            newTile.bringToBack();
            tileLayerRef.current = newTile;
        }
    }, [isLeafletReady, mapStyle, apiKey]);

    // Update Markers when dealers, selected dealer, or pinStyle changes
    useEffect(() => {
        if (!isLeafletReady || !L) return;
        const leaflet = L;
        const map = mapInstanceRef.current;
        const layer = markersLayerRef.current;
        if (!map || !layer) return;

        layer.clearLayers();

        const latLngs: LTypes.LatLngExpression[] = [];
        let selectedMarker: LTypes.Marker | null = null;

        filteredDealers.forEach((dealer) => {
            if (typeof dealer.latitude !== 'number' || typeof dealer.longitude !== 'number') {
                return;
            }

            const isSelected = String(dealer.id) === String(selectedDealerId);
            const icon = createDealerPinIcon(dealer, isSelected, pinStyle);
            if (!icon) return;

            const marker = leaflet.marker([dealer.latitude, dealer.longitude], {
                icon,
                title: `${dealer.kode_dealer} - ${dealer.nama_dealer}`,
                zIndexOffset: isSelected ? 1000 : 0,
            });

            // Hover tooltip: appears to the SIDE ("ke samping"), strictly horizontal
            const hoverTooltipHtml = `
                <div class="dealer-hover-badge" style="background-color: #111827; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.3); white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; pointer-events: none; border: 1px solid rgba(255,255,255,0.15); line-height: 1.2;">
                    <span style="font-size: 9.5px; font-weight: 700; color: #f87171; text-transform: uppercase;">[${dealer.kode_dealer}]</span>
                    <span style="font-size: 11px; font-weight: 600; color: #f9fafb;">${dealer.nama_dealer}</span>
                </div>
            `;

            marker.bindTooltip(hoverTooltipHtml, {
                direction: 'auto',
                offset: leaflet.point(16, 0),
                className: 'dealer-name-hover-tooltip',
                opacity: 1,
                sticky: false,
            });

            // Rich HTML card using Popup (displayed to the side on click)
            const popupContent = buildDealerPopupHtml(dealer);
            const popup = leaflet.popup({
                autoPan: true,
                autoPanPaddingTopLeft: leaflet.point(30, 30),
                autoPanPaddingBottomRight: leaflet.point(30, 30),
                offset: leaflet.point(182, 100),
                className: 'dealer-custom-leaflet-popup',
                closeButton: true,
                maxWidth: 320,
                minWidth: 290,
            }).setContent(popupContent);

            marker.bindPopup(popup);

            // Dynamically set side offset: right if on left/center of map, left if on right side of map
            const updatePopupSideOffset = () => {
                const mapCurrent = mapInstanceRef.current;
                if (!mapCurrent) return;

                const point = mapCurrent.latLngToContainerPoint([dealer.latitude, dealer.longitude]);
                const mapWidth = mapCurrent.getSize().x;
                const isRightSide = point.x > mapWidth * 0.52;

                popup.options.offset = isRightSide
                    ? leaflet.point(-182, 100) // open to the LEFT side of pin
                    : leaflet.point(182, 100);  // open to the RIGHT side of pin

                popup.update();
            };

            marker.on('popupopen', () => {
                updatePopupSideOffset();
                marker.closeTooltip();
            });

            marker.on('mouseover', () => {
                if (marker.isPopupOpen()) {
                    marker.closeTooltip();
                }
            });

            // Click interaction: update side offset, set active dealer & trigger callback
            marker.on('click', () => {
                updatePopupSideOffset();
                setActiveDealer(dealer);
                if (onSelectDealer) {
                    onSelectDealer(String(dealer.id));
                }
            });

            if (isSelected) {
                selectedMarker = marker;
            }

            layer.addLayer(marker);
            latLngs.push([dealer.latitude, dealer.longitude]);
        });

        // When popup is closed, reset active dealer
        const handlePopupClose = () => {
            setActiveDealer(null);
        };
        map.on('popupclose', handlePopupClose);

        // If a specific dealer is selected, fly to it and open its popup
        if (selectedDealerId && selectedMarker) {
            const matched = filteredDealers.find((d) => String(d.id) === String(selectedDealerId));
            if (matched && matched.latitude && matched.longitude) {
                setActiveDealer(matched);
                map.flyTo([matched.latitude, matched.longitude], 14, { duration: 1 });
                setTimeout(() => {
                    selectedMarker?.openPopup();
                }, 1050);
                return () => {
                    map.off('popupclose', handlePopupClose);
                };
            }
        }

        // Fit bounds if multiple markers exist with generous padding
        if (latLngs.length > 0 && !selectedDealerId) {
            map.fitBounds(leaflet.latLngBounds(latLngs), {
                paddingTopLeft: [50, 100],
                paddingBottomRight: [50, 60],
                maxZoom: 13,
            });
        }

        return () => {
            map.off('popupclose', handlePopupClose);
        };
    }, [isLeafletReady, filteredDealers, selectedDealerId, onSelectDealer, pinStyle]);

    // Handle Reset View
    const handleResetView = () => {
        const map = mapInstanceRef.current;
        if (!map || !L) return;
        const leaflet = L;

        map.closePopup();

        const validCoords = dealers
            .filter((d) => d.latitude && d.longitude)
            .map((d) => [d.latitude, d.longitude] as LTypes.LatLngExpression);

        if (validCoords.length > 0) {
            map.fitBounds(leaflet.latLngBounds(validCoords), {
                paddingTopLeft: [50, 100],
                paddingBottomRight: [50, 60],
                maxZoom: 13,
            });
        } else {
            map.setView([-8.65, 117.3], 9);
        }
        setActiveDealer(null);
    };

    return (
        <div
            className={`relative flex flex-col rounded-xl border bg-card shadow-xs transition-all duration-300 ${
                isFullscreen
                    ? 'fixed inset-0 z-50 rounded-none border-0 h-screen w-screen p-4 bg-background/95 backdrop-blur-md'
                    : className
            }`}
        >
            {/* Header & Controls */}
            <div className="relative z-20 flex flex-col gap-3 p-4 border-b bg-card/80 backdrop-blur-xs sm:flex-row sm:items-center sm:justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                        <MapPin className="size-4.5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="font-semibold text-sm sm:text-base tracking-tight text-foreground">
                                Peta Sebaran Dealer Honda
                            </h2>
                            <Badge variant="secondary" className="font-mono text-xs font-semibold">
                                {filteredDealers.length} Dealer
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Klik pin point untuk melihat profil showroom, rating, alamat, dan rekap ulasan.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative w-44 sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cari Dealer. . ."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2.5 text-xs shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>

                    {/* Quick Rating Filter */}
                    <div className="flex items-center rounded-md border bg-muted/30 p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setRatingFilter('all')}
                            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                                ratingFilter === 'all'
                                    ? 'bg-background text-foreground shadow-2xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Semua
                        </button>
                        <button
                            type="button"
                            onClick={() => setRatingFilter('high')}
                            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors flex items-center gap-1 ${
                                ratingFilter === 'high'
                                    ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <span>★</span>
                            <span>≥ 4.8</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setRatingFilter('attention')}
                            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors flex items-center gap-1 ${
                                ratingFilter === 'attention'
                                    ? 'bg-background text-amber-600 dark:text-amber-400 shadow-2xs font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <span>★</span>
                            <span>&lt; 4.8</span>
                        </button>
                    </div>

                    {/* Map Style & Pin Switcher Trigger */}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowStyleModal(true)}
                        className="h-8 px-2.5 gap-1.5 text-xs font-medium border-border/80 shadow-2xs hover:bg-accent cursor-pointer"
                        title="Pilih Model Peta MapTiler & Bentuk Pin"
                    >
                        <Layers className="size-3.5 text-primary" />
                        <span>Desain: <strong className="text-foreground">{MAP_STYLES[mapStyle]?.name?.replace('MapTiler ', '') || 'Streets'}</strong></span>
                        <Palette className="size-3 text-muted-foreground ml-0.5" />
                    </Button>

                    {/* Reset Map View */}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetView}
                        className="h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        title="Reset Tampilan Peta NTB"
                    >
                        <RotateCcw className="size-3.5" />
                        <span className="hidden sm:inline">Reset</span>
                    </Button>

                    {/* Fullscreen Toggle */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setIsFullscreen(!isFullscreen);
                            setTimeout(() => {
                                mapInstanceRef.current?.invalidateSize();
                            }, 200);
                        }}
                        className="h-8 w-8 p-0"
                        title={isFullscreen ? 'Keluar Layar Penuh' : 'Tampilkan Layar Penuh'}
                    >
                        {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                    </Button>
                </div>
            </div>


            {/* Map Style & Configuration Modal (Ant Design) */}
            <AntModal
                open={showStyleModal}
                onCancel={() => setShowStyleModal(false)}
                footer={null}
                title={
                    <div className="flex items-center gap-2 text-base font-semibold">
                        <Palette className="size-5 text-primary" />
                        <span>Desain & Model Peta MapTiler</span>
                    </div>
                }
                width={700}
                centered
            >
                <p className="text-xs text-muted-foreground mb-4">
                    Pilih gaya visual peta MapTiler dan bentuk pin showroom Honda.
                </p>

                {/* Pilihan Model Peta MapTiler */}
                <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Pilih Model Peta ({Object.keys(MAP_STYLES).length} Pilihan)
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                            Terpilih: <strong>{MAP_STYLES[mapStyle]?.name}</strong>
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(Object.keys(MAP_STYLES) as MapTileStyle[]).map((key) => {
                            const style = MAP_STYLES[key];
                            const isActive = mapStyle === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleSelectMapStyle(key)}
                                    className={`flex items-start justify-between rounded-xl p-3 text-left transition-all cursor-pointer ${
                                        isActive
                                            ? 'bg-primary/10 text-foreground border-2 border-primary shadow-xs ring-1 ring-primary/30'
                                            : 'bg-card hover:bg-muted/60 border text-foreground'
                                    }`}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <span className="text-2xl shrink-0 mt-0.5">{style.icon}</span>
                                        <div>
                                            <div className="text-xs font-semibold leading-tight flex items-center gap-1.5">
                                                <span>{style.name}</span>
                                                {isActive && (
                                                    <AntTag color="error" className="text-[9.5px] leading-tight px-1.5 py-0 rounded m-0">Aktif</AntTag>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                                                {style.description}
                                            </div>
                                        </div>
                                    </div>
                                    {isActive ? (
                                        <div className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                                            <Check className="size-3 stroke-[3]" />
                                        </div>
                                    ) : (
                                        <div className="size-5 rounded-full border border-muted-foreground/30 shrink-0 mt-0.5" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Section 2: Bentuk Pin Marker Showroom */}
                <div className="space-y-2 pt-4 mt-3 border-t">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Bentuk Pin Marker Dealer Honda
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                            { id: 'capsule', name: 'Kapsul Modern', desc: 'Ramping, rating jelas, logo sayap Honda', icon: '💊' },
                            { id: 'teardrop', name: 'Pin Teardrop', desc: 'Pin klasik ala Google Maps', icon: '📍' },
                            { id: 'badge', name: 'Badge Showroom', desc: 'Badge kotak showroom dengan rating', icon: '🏷️' },
                        ].map((p) => {
                            const isActive = pinStyle === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleSelectPinStyle(p.id as MapPinStyle)}
                                    className={`flex items-start justify-between rounded-xl p-3 text-left transition-all cursor-pointer ${
                                        isActive
                                            ? 'bg-primary/10 text-foreground border-2 border-primary shadow-xs'
                                            : 'bg-card hover:bg-muted/60 border text-foreground'
                                    }`}
                                >
                                    <div className="flex items-start gap-2">
                                        <span className="text-xl shrink-0 mt-0.5">{p.icon}</span>
                                        <div>
                                            <div className="text-xs font-semibold leading-tight">{p.name}</div>
                                            <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-tight">{p.desc}</div>
                                        </div>
                                    </div>
                                    {isActive && <Check className="size-4 text-primary shrink-0 mt-0.5" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </AntModal>

            {/* Map Canvas with generous height */}
            <div className="relative flex-1 min-h-[520px] lg:min-h-[580px] w-full bg-muted/20">
                <div ref={mapContainerRef} className="absolute inset-0 size-full z-0" />

                {!isLeafletReady && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/30 backdrop-blur-[2px] text-muted-foreground">
                        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-xs font-medium">Memuat peta showroom...</span>
                    </div>
                )}

                {/* Legend Overlay at bottom-left */}
                <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2.5 rounded-lg border bg-background/90 px-3 py-1.5 text-[11px] font-medium shadow-md backdrop-blur-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        <div className="size-2 rounded-full bg-rose-600 animate-pulse" />
                        Dealer Honda ({filteredDealers.length})
                    </span>
                    <span className="text-muted-foreground/40">|</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span>★</span> ≥ 4.8
                    </span>
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <span>★</span> &lt; 4.8
                    </span>
                </div>
            </div>

            {/* Selected Dealer Summary Bar if active */}
            {activeDealer && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-muted/30 border-t text-xs shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary font-bold">
                            <Building2 className="size-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                    {activeDealer.nama_dealer}
                                </span>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                    {activeDealer.kode_dealer}
                                </Badge>
                                <span className="text-amber-500 font-bold flex items-center gap-0.5">
                                    <Star className="size-3 fill-amber-400" />
                                    {activeDealer.star_rate ?? '-'}
                                </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground line-clamp-1">
                                {activeDealer.alamat || 'Alamat tidak tersedia'}
                                {activeDealer.kelurahan ? `, Kel. ${activeDealer.kelurahan}` : ''}
                                {activeDealer.kecamatan ? `, Kec. ${activeDealer.kecamatan}` : ''}
                                {activeDealer.pos_code ? ` ${activeDealer.pos_code}` : ''}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {activeDealer.no_telp_showroom && (
                            <Button variant="outline" size="sm" asChild className="h-7 text-xs gap-1.5">
                                <a href={`tel:${activeDealer.no_telp_showroom}`}>
                                    <Phone className="size-3 text-emerald-600" />
                                    <span>{activeDealer.no_telp_showroom}</span>
                                </a>
                            </Button>
                        )}
                        {activeDealer.link_google_maps && (
                            <Button variant="outline" size="sm" asChild className="h-7 text-xs gap-1">
                                <a href={activeDealer.link_google_maps} target="_blank" rel="noopener noreferrer">
                                    <span>Google Maps</span>
                                    <ExternalLink className="size-3 text-muted-foreground" />
                                </a>
                            </Button>
                        )}
                        <Button size="sm" asChild className="h-7 text-xs gap-1">
                            <a href={reviewsRoute.index.url({ query: { dealer_id: activeDealer.id } })}>
                                <MessageSquare className="size-3" />
                                <span>Lihat Review ({activeDealer.recap.total_maps_reviews})</span>
                            </a>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
