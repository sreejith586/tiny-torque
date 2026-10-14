
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ai_scan_jobs": {
                  Row: {
                    "accepted_count": number,"candidates": NonNullable<Json>,"cost_usd": number | null,"created_at": string,"error": string | null,"id": string,"input_tokens": number | null,"kind": Database["public"]['Enums']["scan_kind"],"latency_ms": number | null,"media_id": string | null,"model": string | null,"output_tokens": number | null,"status": Database["public"]['Enums']["scan_status"],"user_id": string
                  }
                  Insert: {
                    "accepted_count"?: number,"candidates"?: NonNullable<Json>,"cost_usd"?: number | null,"created_at"?: string,"error"?: string | null,"id"?: string,"input_tokens"?: number | null,"kind": Database["public"]['Enums']["scan_kind"],"latency_ms"?: number | null,"media_id"?: string | null,"model"?: string | null,"output_tokens"?: number | null,"status"?: Database["public"]['Enums']["scan_status"],"user_id": string
                  }
                  Update: {
                    "accepted_count"?: number,"candidates"?: NonNullable<Json>,"cost_usd"?: number | null,"created_at"?: string,"error"?: string | null,"id"?: string,"input_tokens"?: number | null,"kind"?: Database["public"]['Enums']["scan_kind"],"latency_ms"?: number | null,"media_id"?: string | null,"model"?: string | null,"output_tokens"?: number | null,"status"?: Database["public"]['Enums']["scan_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_scan_jobs_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_scan_jobs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_scan_jobs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"catalog_brands": {
                  Row: {
                    "created_at": string,"id": string,"logo_media_id": string | null,"name": string,"proposed_by": string | null,"slug": string,"status": Database["public"]['Enums']["catalog_status"]
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"logo_media_id"?: string | null,"name": string,"proposed_by"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["catalog_status"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"logo_media_id"?: string | null,"name"?: string,"proposed_by"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["catalog_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_brands_logo_media_id_fkey"
      columns: ["logo_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_brands_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_brands_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"catalog_models": {
                  Row: {
                    "brand_id": string,"casting_code": string | null,"color_variants": NonNullable<Json>,"created_at": string,"id": string,"merged_into_id": string | null,"name": string,"proposed_by": string | null,"scale": string | null,"search": unknown,"series": string | null,"status": Database["public"]['Enums']["model_status"],"verified_by": string | null,"year": number | null
                  }
                  Insert: {
                    "brand_id": string,"casting_code"?: string | null,"color_variants"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"merged_into_id"?: string | null,"name": string,"proposed_by"?: string | null,"scale"?: string | null,"search"?: never,"series"?: string | null,"status"?: Database["public"]['Enums']["model_status"],"verified_by"?: string | null,"year"?: number | null
                  }
                  Update: {
                    "brand_id"?: string,"casting_code"?: string | null,"color_variants"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"merged_into_id"?: string | null,"name"?: string,"proposed_by"?: string | null,"scale"?: string | null,"search"?: never,"series"?: string | null,"status"?: Database["public"]['Enums']["model_status"],"verified_by"?: string | null,"year"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_models_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "catalog_brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_models_merged_into_id_fkey"
      columns: ["merged_into_id"]
isOneToOne: false
      referencedRelation: "catalog_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_models_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_models_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_models_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_models_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"collection_items": {
                  Row: {
                    "ask_price": number | null,"brand": string,"card_type": string | null,"catalog_model_id": string | null,"color": string | null,"condition": string | null,"created_at": string,"currency": string | null,"deleted_at": string | null,"for_sale": boolean,"id": string,"is_favorite": boolean,"is_public": boolean,"model": string | null,"notes": string | null,"open_to_offers": boolean,"open_to_trade": boolean,"owner_id": string,"photo": string | null,"photos": NonNullable<Json>,"price_paid": number,"qty": number,"rarity": string | null,"scale": string | null,"search": unknown,"series": string | null,"source": string | null,"updated_at": string,"variant": string | null
                  }
                  Insert: {
                    "ask_price"?: number | null,"brand": string,"card_type"?: string | null,"catalog_model_id"?: string | null,"color"?: string | null,"condition"?: string | null,"created_at"?: string,"currency"?: string | null,"deleted_at"?: string | null,"for_sale"?: boolean,"id"?: string,"is_favorite"?: boolean,"is_public"?: boolean,"model"?: string | null,"notes"?: string | null,"open_to_offers"?: boolean,"open_to_trade"?: boolean,"owner_id": string,"photo"?: string | null,"photos"?: NonNullable<Json>,"price_paid"?: number,"qty"?: number,"rarity"?: string | null,"scale"?: string | null,"search"?: never,"series"?: string | null,"source"?: string | null,"updated_at"?: string,"variant"?: string | null
                  }
                  Update: {
                    "ask_price"?: number | null,"brand"?: string,"card_type"?: string | null,"catalog_model_id"?: string | null,"color"?: string | null,"condition"?: string | null,"created_at"?: string,"currency"?: string | null,"deleted_at"?: string | null,"for_sale"?: boolean,"id"?: string,"is_favorite"?: boolean,"is_public"?: boolean,"model"?: string | null,"notes"?: string | null,"open_to_offers"?: boolean,"open_to_trade"?: boolean,"owner_id"?: string,"photo"?: string | null,"photos"?: NonNullable<Json>,"price_paid"?: number,"qty"?: number,"rarity"?: string | null,"scale"?: string | null,"search"?: never,"series"?: string | null,"source"?: string | null,"updated_at"?: string,"variant"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "collection_items_catalog_model_fk"
      columns: ["catalog_model_id"]
isOneToOne: false
      referencedRelation: "catalog_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"countries": {
                  Row: {
                    "code": string,"currency": string,"dial_code": string,"enabled": boolean,"name": string
                  }
                  Insert: {
                    "code": string,"currency": string,"dial_code": string,"enabled"?: boolean,"name": string
                  }
                  Update: {
                    "code"?: string,"currency"?: string,"dial_code"?: string,"enabled"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"deal_messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"offer_id": string,"read_at": string | null,"sender_id": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"offer_id": string,"read_at"?: string | null,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"offer_id"?: string,"read_at"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deal_messages_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: false
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deal_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deal_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"domain_events": {
                  Row: {
                    "actor_id": string | null,"entity": string,"entity_id": string | null,"id": number,"occurred_at": string,"payload": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"entity": string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"entity"?: string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "domain_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "domain_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"domain_events_2026_09": {
                  Row: {
                    "actor_id": string | null,"entity": string,"entity_id": string | null,"id": number,"occurred_at": string,"payload": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"entity": string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"entity"?: string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"domain_events_2026_10": {
                  Row: {
                    "actor_id": string | null,"entity": string,"entity_id": string | null,"id": number,"occurred_at": string,"payload": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"entity": string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"entity"?: string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"domain_events_2026_11": {
                  Row: {
                    "actor_id": string | null,"entity": string,"entity_id": string | null,"id": number,"occurred_at": string,"payload": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"entity": string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"entity"?: string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"domain_events_2026_12": {
                  Row: {
                    "actor_id": string | null,"entity": string,"entity_id": string | null,"id": number,"occurred_at": string,"payload": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"entity": string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"entity"?: string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"domain_events_default": {
                  Row: {
                    "actor_id": string | null,"entity": string,"entity_id": string | null,"id": number,"occurred_at": string,"payload": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"entity": string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"entity"?: string,"entity_id"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"feature_flags": {
                  Row: {
                    "audience": NonNullable<Json>,"description": string | null,"enabled": boolean,"key": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "audience"?: NonNullable<Json>,"description"?: string | null,"enabled"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "audience"?: NonNullable<Json>,"description"?: string | null,"enabled"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "feature_flags_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feature_flags_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "created_at": string,"followee_id": string,"follower_id": string
                  }
                  Insert: {
                    "created_at"?: string,"followee_id": string,"follower_id": string
                  }
                  Update: {
                    "created_at"?: string,"followee_id"?: string,"follower_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_followee_id_fkey"
      columns: ["followee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_followee_id_fkey"
      columns: ["followee_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "code": string,"cohort": string | null,"created_at": string,"created_by": string | null,"expires_at": string | null,"max_uses": number,"used_count": number
                  }
                  Insert: {
                    "code": string,"cohort"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"max_uses"?: number,"used_count"?: number
                  }
                  Update: {
                    "code"?: string,"cohort"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"max_uses"?: number,"used_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_favorites": {
                  Row: {
                    "created_at": string,"listing_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"listing_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"listing_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_favorites_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "marketplace_listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"marketplace_listings": {
                  Row: {
                    "brand": string,"catalog_model_id": string | null,"condition": string | null,"country_code": string | null,"created_at": string,"currency": string,"deleted_at": string | null,"description": string | null,"expires_at": string | null,"favorite_count": number,"id": string,"listing_type": Database["public"]['Enums']["listing_type"],"min_offer": number | null,"model": string | null,"offer_count": number,"offers": NonNullable<Json>,"open_to_offers": boolean,"open_to_trade": boolean,"photo": string | null,"photos": NonNullable<Json>,"price": number,"qty": number,"rarity": string | null,"search": unknown,"seller_id": string,"seller_location": string | null,"seller_mobile": string | null,"seller_name": string | null,"seller_photo": string | null,"seller_type": string | null,"sold_at": string | null,"sold_offer_id": string | null,"source_item_id": string | null,"status": Database["public"]['Enums']["listing_status"],"updated_at": string,"variant": string | null,"view_count": number
                  }
                  Insert: {
                    "brand": string,"catalog_model_id"?: string | null,"condition"?: string | null,"country_code"?: string | null,"created_at"?: string,"currency"?: string,"deleted_at"?: string | null,"description"?: string | null,"expires_at"?: string | null,"favorite_count"?: number,"id"?: string,"listing_type"?: Database["public"]['Enums']["listing_type"],"min_offer"?: number | null,"model"?: string | null,"offer_count"?: number,"offers"?: NonNullable<Json>,"open_to_offers"?: boolean,"open_to_trade"?: boolean,"photo"?: string | null,"photos"?: NonNullable<Json>,"price"?: number,"qty"?: number,"rarity"?: string | null,"search"?: never,"seller_id": string,"seller_location"?: string | null,"seller_mobile"?: string | null,"seller_name"?: string | null,"seller_photo"?: string | null,"seller_type"?: string | null,"sold_at"?: string | null,"sold_offer_id"?: string | null,"source_item_id"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"updated_at"?: string,"variant"?: string | null,"view_count"?: number
                  }
                  Update: {
                    "brand"?: string,"catalog_model_id"?: string | null,"condition"?: string | null,"country_code"?: string | null,"created_at"?: string,"currency"?: string,"deleted_at"?: string | null,"description"?: string | null,"expires_at"?: string | null,"favorite_count"?: number,"id"?: string,"listing_type"?: Database["public"]['Enums']["listing_type"],"min_offer"?: number | null,"model"?: string | null,"offer_count"?: number,"offers"?: NonNullable<Json>,"open_to_offers"?: boolean,"open_to_trade"?: boolean,"photo"?: string | null,"photos"?: NonNullable<Json>,"price"?: number,"qty"?: number,"rarity"?: string | null,"search"?: never,"seller_id"?: string,"seller_location"?: string | null,"seller_mobile"?: string | null,"seller_name"?: string | null,"seller_photo"?: string | null,"seller_type"?: string | null,"sold_at"?: string | null,"sold_offer_id"?: string | null,"source_item_id"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"updated_at"?: string,"variant"?: string | null,"view_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "marketplace_listings_catalog_model_id_fkey"
      columns: ["catalog_model_id"]
isOneToOne: false
      referencedRelation: "catalog_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "marketplace_listings_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "marketplace_listings_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "marketplace_listings_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "marketplace_listings_sold_offer_fk"
      columns: ["sold_offer_id"]
isOneToOne: false
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "marketplace_listings_source_item_id_fkey"
      columns: ["source_item_id"]
isOneToOne: false
      referencedRelation: "collection_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "marketplace_listings_source_item_id_fkey"
      columns: ["source_item_id"]
isOneToOne: false
      referencedRelation: "collection_items_v1"
      referencedColumns: ["id"]
    }
                  ]
                },"media": {
                  Row: {
                    "bucket": string,"bytes": number | null,"created_at": string,"entity_id": string | null,"height": number | null,"id": string,"kind": Database["public"]['Enums']["media_kind"],"owner_id": string,"path": string,"sort_order": number,"status": Database["public"]['Enums']["media_status"],"width": number | null
                  }
                  Insert: {
                    "bucket": string,"bytes"?: number | null,"created_at"?: string,"entity_id"?: string | null,"height"?: number | null,"id"?: string,"kind": Database["public"]['Enums']["media_kind"],"owner_id": string,"path": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["media_status"],"width"?: number | null
                  }
                  Update: {
                    "bucket"?: string,"bytes"?: number | null,"created_at"?: string,"entity_id"?: string | null,"height"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["media_kind"],"owner_id"?: string,"path"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["media_status"],"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": string,"payload": NonNullable<Json>,"read_at": string | null,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"offers": {
                  Row: {
                    "amount": number | null,"buyer_id": string,"completed_at": string | null,"created_at": string,"currency": string | null,"decline_reason": string | null,"expires_at": string,"id": string,"listing_id": string,"message": string | null,"responded_at": string | null,"seller_id": string,"status": Database["public"]['Enums']["offer_status"],"trade_item_ids": (string)[],"type": Database["public"]['Enums']["offer_type"]
                  }
                  Insert: {
                    "amount"?: number | null,"buyer_id": string,"completed_at"?: string | null,"created_at"?: string,"currency"?: string | null,"decline_reason"?: string | null,"expires_at"?: string,"id"?: string,"listing_id": string,"message"?: string | null,"responded_at"?: string | null,"seller_id": string,"status"?: Database["public"]['Enums']["offer_status"],"trade_item_ids"?: (string)[],"type": Database["public"]['Enums']["offer_type"]
                  }
                  Update: {
                    "amount"?: number | null,"buyer_id"?: string,"completed_at"?: string | null,"created_at"?: string,"currency"?: string | null,"decline_reason"?: string | null,"expires_at"?: string,"id"?: string,"listing_id"?: string,"message"?: string | null,"responded_at"?: string | null,"seller_id"?: string,"status"?: Database["public"]['Enums']["offer_status"],"trade_item_ids"?: (string)[],"type"?: Database["public"]['Enums']["offer_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "offers_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "marketplace_listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "account_type": Database["public"]['Enums']["account_type"],"bio": string | null,"city": string | null,"country_code": string,"created_at": string,"deleted_at": string | null,"display_name": string,"handle": string,"handle_changed_at": string | null,"id": string,"level": number,"location": string | null,"mobile": string | null,"onboarding_completed_at": string | null,"photo_url": string | null,"plan": Database["public"]['Enums']["plan_tier"],"pro_until": string | null,"rating_avg": number | null,"rating_count": number,"role": Database["public"]['Enums']["user_role"],"scan_quota_bonus": number,"scan_quota_reset_at": string,"scan_quota_used": number,"store_name": string | null,"suspended_until": string | null,"tokens": number,"tutorial_dismissed_at": string | null,"updated_at": string,"xp": number
                  }
                  Insert: {
                    "account_type": Database["public"]['Enums']["account_type"],"bio"?: string | null,"city"?: string | null,"country_code"?: string,"created_at"?: string,"deleted_at"?: string | null,"display_name": string,"handle": string,"handle_changed_at"?: string | null,"id": string,"level"?: number,"location"?: string | null,"mobile"?: string | null,"onboarding_completed_at"?: string | null,"photo_url"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"pro_until"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"role"?: Database["public"]['Enums']["user_role"],"scan_quota_bonus"?: number,"scan_quota_reset_at"?: string,"scan_quota_used"?: number,"store_name"?: string | null,"suspended_until"?: string | null,"tokens"?: number,"tutorial_dismissed_at"?: string | null,"updated_at"?: string,"xp"?: number
                  }
                  Update: {
                    "account_type"?: Database["public"]['Enums']["account_type"],"bio"?: string | null,"city"?: string | null,"country_code"?: string,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string,"handle"?: string,"handle_changed_at"?: string | null,"id"?: string,"level"?: number,"location"?: string | null,"mobile"?: string | null,"onboarding_completed_at"?: string | null,"photo_url"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"pro_until"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"role"?: Database["public"]['Enums']["user_role"],"scan_quota_bonus"?: number,"scan_quota_reset_at"?: string,"scan_quota_used"?: number,"store_name"?: string | null,"suspended_until"?: string | null,"tokens"?: number,"tutorial_dismissed_at"?: string | null,"updated_at"?: string,"xp"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"id": string,"notes": string | null,"reason": string | null,"reporter_id": string,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string | null,"target_name": string | null,"target_type": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"notes"?: string | null,"reason"?: string | null,"reporter_id": string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string | null,"target_name"?: string | null,"target_type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"notes"?: string | null,"reason"?: string | null,"reporter_id"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string | null,"target_name"?: string | null,"target_type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seller_reviews": {
                  Row: {
                    "buyer_id": string | null,"comment": string | null,"created_at": string,"deleted_at": string | null,"id": string,"offer_id": string,"rating": number,"seller_id": string,"updated_at": string
                  }
                  Insert: {
                    "buyer_id"?: string | null,"comment"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"offer_id": string,"rating": number,"seller_id": string,"updated_at"?: string
                  }
                  Update: {
                    "buyer_id"?: string | null,"comment"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"offer_id"?: string,"rating"?: number,"seller_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seller_reviews_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_reviews_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_reviews_offer_fk"
      columns: ["offer_id"]
isOneToOne: true
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_reviews_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_reviews_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"wishlist_items": {
                  Row: {
                    "brand": string | null,"catalog_model_id": string | null,"created_at": string,"currency": string | null,"deleted_at": string | null,"id": string,"max_price": number | null,"model": string | null,"notes": string | null,"notify": boolean,"owner_id": string,"updated_at": string
                  }
                  Insert: {
                    "brand"?: string | null,"catalog_model_id"?: string | null,"created_at"?: string,"currency"?: string | null,"deleted_at"?: string | null,"id"?: string,"max_price"?: number | null,"model"?: string | null,"notes"?: string | null,"notify"?: boolean,"owner_id": string,"updated_at"?: string
                  }
                  Update: {
                    "brand"?: string | null,"catalog_model_id"?: string | null,"created_at"?: string,"currency"?: string | null,"deleted_at"?: string | null,"id"?: string,"max_price"?: number | null,"model"?: string | null,"notes"?: string | null,"notify"?: boolean,"owner_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlist_items_catalog_model_id_fkey"
      columns: ["catalog_model_id"]
isOneToOne: false
      referencedRelation: "catalog_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishlist_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishlist_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "collection_items_v1": {
                  Row: {
                    "ask_price": number | null,"brand": string | null,"card_type": string | null,"condition": string | null,"created_at": string | null,"deleted_at": string | null,"for_sale": boolean | null,"id": string | null,"is_public": boolean | null,"model": string | null,"open_to_offers": boolean | null,"open_to_trade": boolean | null,"owner_id": string | null,"photo": string | null,"photos": Json | null,"price_paid": number | null,"qty": number | null,"rarity": string | null,"scale": string | null,"series": string | null,"source": string | null,"updated_at": string | null,"variant": string | null
                  }
                  Insert: {
                           "ask_price"?: number | null,"brand"?: string | null,"card_type"?: string | null,"condition"?: string | null,"created_at"?: string | null,"deleted_at"?: string | null,"for_sale"?: boolean | null,"id"?: string | null,"is_public"?: boolean | null,"model"?: string | null,"open_to_offers"?: boolean | null,"open_to_trade"?: boolean | null,"owner_id"?: string | null,"photo"?: string | null,"photos"?: Json | null,"price_paid"?: number | null,"qty"?: number | null,"rarity"?: string | null,"scale"?: string | null,"series"?: string | null,"source"?: string | null,"updated_at"?: string | null,"variant"?: string | null
                         }
                        Update: {
                           "ask_price"?: number | null,"brand"?: string | null,"card_type"?: string | null,"condition"?: string | null,"created_at"?: string | null,"deleted_at"?: string | null,"for_sale"?: boolean | null,"id"?: string | null,"is_public"?: boolean | null,"model"?: string | null,"open_to_offers"?: boolean | null,"open_to_trade"?: boolean | null,"owner_id"?: string | null,"photo"?: string | null,"photos"?: Json | null,"price_paid"?: number | null,"qty"?: number | null,"rarity"?: string | null,"scale"?: string | null,"series"?: string | null,"source"?: string | null,"updated_at"?: string | null,"variant"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "collection_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"public_profiles": {
                  Row: {
                    "account_type": Database["public"]['Enums']["account_type"] | null,"bio": string | null,"city": string | null,"country_code": string | null,"created_at": string | null,"display_name": string | null,"handle": string | null,"id": string | null,"is_pro": boolean | null,"level": number | null,"rating_avg": number | null,"rating_count": number | null,"store_name": string | null,"xp": number | null
                  }
                  Insert: {
                           "account_type"?: Database["public"]['Enums']["account_type"] | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"handle"?: string | null,"id"?: string | null,"is_pro"?: never,"level"?: number | null,"rating_avg"?: number | null,"rating_count"?: number | null,"store_name"?: string | null,"xp"?: number | null
                         }
                        Update: {
                           "account_type"?: Database["public"]['Enums']["account_type"] | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"handle"?: string | null,"id"?: string | null,"is_pro"?: never,"level"?: number | null,"rating_avg"?: number | null,"rating_count"?: number | null,"store_name"?: string | null,"xp"?: number | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "profiles_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    }
                  ]
                }
          }
          Functions: {
            "buy_now":
{ Args: { "p_listing_id": string }; Returns: {
              "amount": number | null,
"buyer_id": string,
"completed_at": string | null,
"created_at": string,
"currency": string | null,
"decline_reason": string | null,
"expires_at": string,
"id": string,
"listing_id": string,
"message": string | null,
"responded_at": string | null,
"seller_id": string,
"status": Database["public"]['Enums']["offer_status"],
"trade_item_ids": (string)[],
"type": Database["public"]['Enums']["offer_type"]
            }
                          SetofOptions: {
        from: "*"
        to: "offers"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_offer":
{ Args: { "p_amount"?: number,"p_listing_id": string,"p_message"?: string,"p_trade_item_ids"?: (string)[],"p_type": Database["public"]['Enums']["offer_type"] }; Returns: {
              "amount": number | null,
"buyer_id": string,
"completed_at": string | null,
"created_at": string,
"currency": string | null,
"decline_reason": string | null,
"expires_at": string,
"id": string,
"listing_id": string,
"message": string | null,
"responded_at": string | null,
"seller_id": string,
"status": Database["public"]['Enums']["offer_status"],
"trade_item_ids": (string)[],
"type": Database["public"]['Enums']["offer_type"]
            }
                          SetofOptions: {
        from: "*"
        to: "offers"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_report":
{ Args: { "p_notes"?: string,"p_reason"?: string,"p_target_id": string,"p_target_name"?: string,"p_target_type": string }; Returns: {
              "created_at": string,
"deleted_at": string | null,
"id": string,
"notes": string | null,
"reason": string | null,
"reporter_id": string,
"resolution_note": string | null,
"resolved_at": string | null,
"resolved_by": string | null,
"status": Database["public"]['Enums']["report_status"],
"target_id": string | null,
"target_name": string | null,
"target_type": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "reports"
        isOneToOne: true
        isSetofReturn: false
      } },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"emit_event":
{ Args: { "p_actor_id": string,"p_entity": string,"p_entity_id"?: string,"p_payload"?: Json,"p_type": string }; Returns: undefined
                           },
"entitlement_listing_slots":
{ Args: { "p_user": string }; Returns: number
                           },
"entitlement_scan_quota":
{ Args: { "p_user": string }; Returns: number
                           },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"increment_listing_view":
{ Args: { "p_listing_id": string }; Returns: undefined
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_blocked":
{ Args: { "p_a": string,"p_b": string }; Returns: boolean
                           },
"is_pro":
{ Args: { "p_user"?: string }; Returns: boolean
                           },
"match_catalog_models":
{ Args: { "p_limit"?: number,"p_name": string }; Returns: {
              "brand_id": string,"id": string,"name": string,"score": number
            }[]
                           },
"media_is_public":
{ Args: { "p_media_id": string }; Returns: boolean
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"redeem_invite":
{ Args: { "p_code": string }; Returns: undefined
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"transition_offer":
{ Args: { "p_action": string,"p_offer_id": string }; Returns: {
              "amount": number | null,
"buyer_id": string,
"completed_at": string | null,
"created_at": string,
"currency": string | null,
"decline_reason": string | null,
"expires_at": string,
"id": string,
"listing_id": string,
"message": string | null,
"responded_at": string | null,
"seller_id": string,
"status": Database["public"]['Enums']["offer_status"],
"trade_item_ids": (string)[],
"type": Database["public"]['Enums']["offer_type"]
            }
                          SetofOptions: {
        from: "*"
        to: "offers"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "account_type": "individual"|"shop","catalog_status": "proposed"|"verified","item_condition": "mint"|"near-mint"|"good"|"played"|"damaged","item_packaging": "carded"|"blister"|"loose"|"boxed","item_rarity": "common"|"uncommon"|"rare"|"super-rare"|"treasure-hunt"|"chase","listing_status": "active"|"sold"|"removed"|"reserved","listing_type": "sale"|"trade"|"both","media_kind": "item"|"avatar"|"banner"|"listing"|"chat","media_status": "uploading"|"ready"|"flagged"|"removed","model_status": "proposed"|"verified"|"merged","notification_type": "offer_received"|"offer_accepted"|"offer_declined"|"message"|"listing_sold"|"review_received"|"badge_unlocked"|"wishlist_match"|"system","offer_status": "pending"|"accepted"|"declined"|"withdrawn"|"expired"|"completed"|"cancelled","offer_type": "cash"|"buy_now"|"trade","plan_tier": "free"|"pro","report_status": "open"|"reviewed"|"dismissed","scan_kind": "single"|"group"|"visual_search","scan_status": "queued"|"running"|"done"|"failed","user_role": "user"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "account_type": ["individual", "shop"],"catalog_status": ["proposed", "verified"],"item_condition": ["mint", "near-mint", "good", "played", "damaged"],"item_packaging": ["carded", "blister", "loose", "boxed"],"item_rarity": ["common", "uncommon", "rare", "super-rare", "treasure-hunt", "chase"],"listing_status": ["active", "sold", "removed", "reserved"],"listing_type": ["sale", "trade", "both"],"media_kind": ["item", "avatar", "banner", "listing", "chat"],"media_status": ["uploading", "ready", "flagged", "removed"],"model_status": ["proposed", "verified", "merged"],"notification_type": ["offer_received", "offer_accepted", "offer_declined", "message", "listing_sold", "review_received", "badge_unlocked", "wishlist_match", "system"],"offer_status": ["pending", "accepted", "declined", "withdrawn", "expired", "completed", "cancelled"],"offer_type": ["cash", "buy_now", "trade"],"plan_tier": ["free", "pro"],"report_status": ["open", "reviewed", "dismissed"],"scan_kind": ["single", "group", "visual_search"],"scan_status": ["queued", "running", "done", "failed"],"user_role": ["user", "admin"]
          }
        }
} as const

