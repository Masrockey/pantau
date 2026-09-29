import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Building2,
    ExternalLink,
    MapPin,
    Maximize2,
    MessageSquare,
    Minimize2,
    Phone,
    RotateCcw,
    Search,
    Star,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

interface DealerMapProps {
    dealers: MapDealer[];
    selectedDealerId?: string;
    onSelectDealer?: (dealerId: string) => void;
    className?: string;
}

// Custom DivIcon generator using public/pinpoint-icon.png with star rating
function createDealerPinIcon(dealer: MapDealer, isSelected: boolean) {
    const rating = dealer.star_rate !== null && dealer.star_rate !== undefined
        ? dealer.star_rate.toFixed(1)
        : '-';

    return L.divIcon({
        className: 'dealer-marker-div-icon',
        html: `
            <div class="dealer-pin-node cursor-pointer" style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.35)); transition: transform 0.2s ease;">
                <div style="position: relative; background: #ffffff; border-radius: 6px; border: 2px solid ${isSelected ? '#2563eb' : '#dc2626'}; overflow: hidden; padding: 1.5px; box-shadow: ${isSelected ? '0 0 0 3px rgba(37,99,235,0.45)' : 'none'};">
                    <img src="/pinpoint-icon.png" alt="${dealer.nama_dealer}" style="width: 50px; height: 25px; object-fit: contain; display: block;" />
                    <div style="position: absolute; bottom: 1px; right: 2px; background: rgba(0,0,0,0.85); color: #fbbf24; font-size: 8.5px; font-weight: 700; padding: 0.5px 3px; border-radius: 3px; display: flex; align-items: center; gap: 1px; font-family: monospace; line-height: 1;">
                        <span style="color: #fbbf24;">★</span><span>${rating}</span>
                    </div>
                </div>
                <div style="width: 8px; height: 8px; transform: rotate(45deg); margin-top: -4px; background: ${isSelected ? '#2563eb' : '#dc2626'}; border-right: 1.5px solid #ffffff; border-bottom: 1.5px solid #ffffff;"></div>
            </div>
        `,
        iconSize: [54, 35],
        iconAnchor: [27, 34],
        popupAnchor: [0, 0],
        tooltipAnchor: [0, -17],
    });
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
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);

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

    // Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        // Default center on Lombok / NTB
        const map = L.map(mapContainerRef.current, {
            center: [-8.65, 117.3],
            zoom: 9,
            zoomControl: false,
            attributionControl: false,
        });

        // Add Zoom Control to top-right
        L.control.zoom({ position: 'topright' }).addTo(map);

        // Add OpenStreetMap Tile Layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        // Create marker group
        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapInstanceRef.current = map;

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Update Markers when dealers or selected dealer changes
    useEffect(() => {
        const map = mapInstanceRef.current;
        const layer = markersLayerRef.current;
        if (!map || !layer) return;

        layer.clearLayers();

        const latLngs: L.LatLngExpression[] = [];
        let selectedMarker: L.Marker | null = null;

        filteredDealers.forEach((dealer) => {
            if (typeof dealer.latitude !== 'number' || typeof dealer.longitude !== 'number') {
                return;
            }

            const isSelected = String(dealer.id) === String(selectedDealerId);
            const icon = createDealerPinIcon(dealer, isSelected);

            const marker = L.marker([dealer.latitude, dealer.longitude], {
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
                offset: L.point(16, 0),
                className: 'dealer-name-hover-tooltip',
                opacity: 1,
                sticky: false,
            });

            // Rich HTML card using Popup (displayed to the side on click)
            const popupContent = buildDealerPopupHtml(dealer);
            const popup = L.popup({
                autoPan: true,
                autoPanPaddingTopLeft: L.point(30, 30),
                autoPanPaddingBottomRight: L.point(30, 30),
                offset: L.point(182, 100),
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
                    ? L.point(-182, 100) // open to the LEFT side of pin
                    : L.point(182, 100);  // open to the RIGHT side of pin

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
            map.fitBounds(L.latLngBounds(latLngs), {
                paddingTopLeft: [50, 100],
                paddingBottomRight: [50, 60],
                maxZoom: 13,
            });
        }

        return () => {
            map.off('popupclose', handlePopupClose);
        };
    }, [filteredDealers, selectedDealerId, onSelectDealer]);

    // Handle Reset View
    const handleResetView = () => {
        const map = mapInstanceRef.current;
        if (!map) return;

        map.closePopup();

        const validCoords = dealers
            .filter((d) => d.latitude && d.longitude)
            .map((d) => [d.latitude, d.longitude] as L.LatLngExpression);

        if (validCoords.length > 0) {
            map.fitBounds(L.latLngBounds(validCoords), {
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
            className={`relative flex flex-col rounded-xl border bg-card shadow-xs overflow-hidden transition-all duration-300 ${
                isFullscreen
                    ? 'fixed inset-0 z-50 rounded-none border-0 h-screen w-screen p-4 bg-background/95 backdrop-blur-md'
                    : className
            }`}
        >
            {/* Header & Controls */}
            <div className="flex flex-col gap-3 p-4 border-b bg-card/80 backdrop-blur-xs sm:flex-row sm:items-center sm:justify-between shrink-0">
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

            {/* Map Canvas with generous height */}
            <div className="relative flex-1 min-h-[520px] lg:min-h-[580px] w-full bg-muted/20">
                <div ref={mapContainerRef} className="absolute inset-0 size-full z-0" />

                {/* Legend Overlay at bottom-left */}
                <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-lg border bg-background/90 px-3 py-1.5 text-[11px] font-medium shadow-md backdrop-blur-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <img src="/pinpoint-icon.png" alt="Pin" className="h-3.5 w-auto object-contain" />
                        Dealer Honda
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
