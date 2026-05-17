export interface RawDealItem {
  store_id: string;
  store_name: string;
  item_name: string;
  brand?: string;
  current_price: number;
  regular_price?: number;
  size?: string;
  unit?: string;
  source_url?: string;
  source_image_url?: string;
  source_system?: 'flipp' | 'firecrawl' | 'csv' | 'mock';
  source_type?: 'flyer' | 'store-page' | 'manual' | 'mock';
  source_flyer_id?: string;
  source_flyer_name?: string;
  source_item_id?: string;
  source_raw_name?: string;
  source_raw_price?: string;
  sale_start?: string;
  sale_end?: string;
  notes?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  flipp_discount_pct?: number;  // explicit % off badge from Flipp, when present
  normalized_name?: string;
  category?: string;
  week_start?: string;
  week_end?: string;
}

export interface SourceAdapter {
  id: string;
  store_id: string;
  enabled: boolean;
  collect(): Promise<RawDealItem[]>;
}

export interface StoreConfig {
  id: string;
  name: string;
  city: string;
  province: string;
  enabled: boolean;
  website: string;
  flyer_url?: string;
  priority_order: number;
  adapter: string;
  notes?: string;
}
