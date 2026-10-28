
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "achievements": {
                  Row: {
                    "description": string,"icon": string,"key": string,"name": string,"rule": NonNullable<Json>,"sort_order": number
                  }
                  Insert: {
                    "description": string,"icon"?: string,"key": string,"name": string,"rule"?: NonNullable<Json>,"sort_order"?: number
                  }
                  Update: {
                    "description"?: string,"icon"?: string,"key"?: string,"name"?: string,"rule"?: NonNullable<Json>,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ai_scan_jobs": {
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
                },"entitlement_grants": {
                  Row: {
                    "created_at": string,"expires_at": string | null,"id": string,"kind": Database["public"]['Enums']["entitlement_grant_kind"],"ledger_id": string | null,"quantity": number,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"expires_at"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["entitlement_grant_kind"],"ledger_id"?: string | null,"quantity"?: number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["entitlement_grant_kind"],"ledger_id"?: string | null,"quantity"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entitlement_grants_ledger_id_fkey"
      columns: ["ledger_id"]
isOneToOne: false
      referencedRelation: "token_ledger"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlement_grants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlement_grants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
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
                },"feedback": {
                  Row: {
                    "created_at": string,"id": string,"kind": Database["public"]['Enums']["feedback_kind"],"message": string,"page": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["feedback_kind"],"message": string,"page"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["feedback_kind"],"message"?: string,"page"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_user_id_fkey"
      columns: ["user_id"]
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
                    "account_type": Database["public"]['Enums']["account_type"],"age_confirmed_at": string | null,"banner_media_id": string | null,"bio": string | null,"city": string | null,"country_code": string,"created_at": string,"deleted_at": string | null,"display_name": string,"handle": string,"handle_changed_at": string | null,"id": string,"level": number,"location": string | null,"mobile": string | null,"onboarding_completed_at": string | null,"photo_url": string | null,"plan": Database["public"]['Enums']["plan_tier"],"pro_until": string | null,"rating_avg": number | null,"rating_count": number,"role": Database["public"]['Enums']["user_role"],"scan_quota_bonus": number,"scan_quota_reset_at": string,"scan_quota_used": number,"store_name": string | null,"suspended_until": string | null,"terms_version": string | null,"tokens": number,"tutorial_dismissed_at": string | null,"updated_at": string,"xp": number
                  }
                  Insert: {
                    "account_type": Database["public"]['Enums']["account_type"],"age_confirmed_at"?: string | null,"banner_media_id"?: string | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string,"created_at"?: string,"deleted_at"?: string | null,"display_name": string,"handle": string,"handle_changed_at"?: string | null,"id": string,"level"?: number,"location"?: string | null,"mobile"?: string | null,"onboarding_completed_at"?: string | null,"photo_url"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"pro_until"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"role"?: Database["public"]['Enums']["user_role"],"scan_quota_bonus"?: number,"scan_quota_reset_at"?: string,"scan_quota_used"?: number,"store_name"?: string | null,"suspended_until"?: string | null,"terms_version"?: string | null,"tokens"?: number,"tutorial_dismissed_at"?: string | null,"updated_at"?: string,"xp"?: number
                  }
                  Update: {
                    "account_type"?: Database["public"]['Enums']["account_type"],"age_confirmed_at"?: string | null,"banner_media_id"?: string | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string,"handle"?: string,"handle_changed_at"?: string | null,"id"?: string,"level"?: number,"location"?: string | null,"mobile"?: string | null,"onboarding_completed_at"?: string | null,"photo_url"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"pro_until"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"role"?: Database["public"]['Enums']["user_role"],"scan_quota_bonus"?: number,"scan_quota_reset_at"?: string,"scan_quota_used"?: number,"store_name"?: string | null,"suspended_until"?: string | null,"terms_version"?: string | null,"tokens"?: number,"tutorial_dismissed_at"?: string | null,"updated_at"?: string,"xp"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_banner_media_id_fkey"
      columns: ["banner_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
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
                },"token_ledger": {
                  Row: {
                    "balance_after": number,"created_at": string,"delta": number,"id": string,"idempotency_key": string | null,"reason": Database["public"]['Enums']["token_ledger_reason"],"ref_id": string | null,"ref_type": string | null,"source": Database["public"]['Enums']["token_ledger_source"] | null,"user_id": string
                  }
                  Insert: {
                    "balance_after": number,"created_at"?: string,"delta": number,"id"?: string,"idempotency_key"?: string | null,"reason": Database["public"]['Enums']["token_ledger_reason"],"ref_id"?: string | null,"ref_type"?: string | null,"source"?: Database["public"]['Enums']["token_ledger_source"] | null,"user_id": string
                  }
                  Update: {
                    "balance_after"?: number,"created_at"?: string,"delta"?: number,"id"?: string,"idempotency_key"?: string | null,"reason"?: Database["public"]['Enums']["token_ledger_reason"],"ref_id"?: string | null,"ref_type"?: string | null,"source"?: Database["public"]['Enums']["token_ledger_source"] | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "token_ledger_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "token_ledger_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"token_packs": {
                  Row: {
                    "active": boolean,"id": string,"price_amount": number,"price_currency": string,"sku": string,"sort_order": number,"stripe_price_id": string | null,"tokens": number
                  }
                  Insert: {
                    "active"?: boolean,"id"?: string,"price_amount": number,"price_currency"?: string,"sku": string,"sort_order"?: number,"stripe_price_id"?: string | null,"tokens": number
                  }
                  Update: {
                    "active"?: boolean,"id"?: string,"price_amount"?: number,"price_currency"?: string,"sku"?: string,"sort_order"?: number,"stripe_price_id"?: string | null,"tokens"?: number
                  }
                  Relationships: [
                    
                  ]
                },"token_purchases": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"id": string,"ledger_id": string | null,"pack_id": string,"paid_at": string | null,"provider": Database["public"]['Enums']["token_purchase_provider"],"provider_event_id": string | null,"provider_session_id": string | null,"status": Database["public"]['Enums']["token_purchase_status"],"user_id": string
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"currency": string,"id"?: string,"ledger_id"?: string | null,"pack_id": string,"paid_at"?: string | null,"provider"?: Database["public"]['Enums']["token_purchase_provider"],"provider_event_id"?: string | null,"provider_session_id"?: string | null,"status"?: Database["public"]['Enums']["token_purchase_status"],"user_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"ledger_id"?: string | null,"pack_id"?: string,"paid_at"?: string | null,"provider"?: Database["public"]['Enums']["token_purchase_provider"],"provider_event_id"?: string | null,"provider_session_id"?: string | null,"status"?: Database["public"]['Enums']["token_purchase_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "token_purchases_ledger_id_fkey"
      columns: ["ledger_id"]
isOneToOne: false
      referencedRelation: "token_ledger"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "token_purchases_pack_id_fkey"
      columns: ["pack_id"]
isOneToOne: false
      referencedRelation: "token_packs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "token_purchases_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "token_purchases_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_achievements": {
                  Row: {
                    "achievement_key": string,"progress": number,"unlocked_at": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "achievement_key": string,"progress"?: number,"unlocked_at"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "achievement_key"?: string,"progress"?: number,"unlocked_at"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_achievements_achievement_key_fkey"
      columns: ["achievement_key"]
isOneToOne: false
      referencedRelation: "achievements"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "user_achievements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_achievements_user_id_fkey"
      columns: ["user_id"]
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
                },"world_garages": {
                  Row: {
                    "created_at": string,"extra_slots": number,"featured_item_id": string | null,"layout": NonNullable<Json>,"level": number,"name": string,"open_mode": Database["public"]['Enums']["world_open_mode"],"rename_count": number,"score": number,"theme_item_id": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"extra_slots"?: number,"featured_item_id"?: string | null,"layout"?: NonNullable<Json>,"level"?: number,"name": string,"open_mode"?: Database["public"]['Enums']["world_open_mode"],"rename_count"?: number,"score"?: number,"theme_item_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"extra_slots"?: number,"featured_item_id"?: string | null,"layout"?: NonNullable<Json>,"level"?: number,"name"?: string,"open_mode"?: Database["public"]['Enums']["world_open_mode"],"rename_count"?: number,"score"?: number,"theme_item_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "world_garages_featured_item_id_fkey"
      columns: ["featured_item_id"]
isOneToOne: false
      referencedRelation: "collection_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_garages_featured_item_id_fkey"
      columns: ["featured_item_id"]
isOneToOne: false
      referencedRelation: "collection_items_v1"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_garages_level_fkey"
      columns: ["level"]
isOneToOne: false
      referencedRelation: "world_levels"
      referencedColumns: ["level"]
    },{
      foreignKeyName: "world_garages_theme_item_id_fkey"
      columns: ["theme_item_id"]
isOneToOne: false
      referencedRelation: "world_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_garages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_garages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"world_inventory": {
                  Row: {
                    "acquired_via": Database["public"]['Enums']["world_acquired_via"],"created_at": string,"durable": boolean,"id": string,"item_id": string,"ledger_id": string | null,"user_id": string
                  }
                  Insert: {
                    "acquired_via": Database["public"]['Enums']["world_acquired_via"],"created_at"?: string,"durable"?: boolean,"id"?: string,"item_id": string,"ledger_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "acquired_via"?: Database["public"]['Enums']["world_acquired_via"],"created_at"?: string,"durable"?: boolean,"id"?: string,"item_id"?: string,"ledger_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "world_inventory_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "world_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_inventory_ledger_id_fkey"
      columns: ["ledger_id"]
isOneToOne: false
      referencedRelation: "token_ledger"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_inventory_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_inventory_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"world_items": {
                  Row: {
                    "active": boolean,"art_path": string | null,"created_at": string,"description": string | null,"effect": NonNullable<Json>,"id": string,"kind": Database["public"]['Enums']["world_item_kind"],"min_level": number,"name": string,"price": number | null,"season_id": string | null,"sku": string,"sort_order": number
                  }
                  Insert: {
                    "active"?: boolean,"art_path"?: string | null,"created_at"?: string,"description"?: string | null,"effect"?: NonNullable<Json>,"id"?: string,"kind": Database["public"]['Enums']["world_item_kind"],"min_level"?: number,"name": string,"price"?: number | null,"season_id"?: string | null,"sku": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"art_path"?: string | null,"created_at"?: string,"description"?: string | null,"effect"?: NonNullable<Json>,"id"?: string,"kind"?: Database["public"]['Enums']["world_item_kind"],"min_level"?: number,"name"?: string,"price"?: number | null,"season_id"?: string | null,"sku"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "world_items_min_level_fkey"
      columns: ["min_level"]
isOneToOne: false
      referencedRelation: "world_levels"
      referencedColumns: ["level"]
    }
                  ]
                },"world_levels": {
                  Row: {
                    "decor_slots": number,"display_slots": number,"host_cap": number,"level": number,"max_extra_slots": number,"min_xp_level": number,"name": string,"price": number,"visitor_cap": number
                  }
                  Insert: {
                    "decor_slots": number,"display_slots": number,"host_cap": number,"level": number,"max_extra_slots"?: number,"min_xp_level"?: number,"name": string,"price": number,"visitor_cap": number
                  }
                  Update: {
                    "decor_slots"?: number,"display_slots"?: number,"host_cap"?: number,"level"?: number,"max_extra_slots"?: number,"min_xp_level"?: number,"name"?: string,"price"?: number,"visitor_cap"?: number
                  }
                  Relationships: [
                    
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
                    "account_type": Database["public"]['Enums']["account_type"] | null,"avatar_media_id": string | null,"banner_media_id": string | null,"bio": string | null,"city": string | null,"country_code": string | null,"created_at": string | null,"display_name": string | null,"handle": string | null,"id": string | null,"is_pro": boolean | null,"level": number | null,"rating_avg": number | null,"rating_count": number | null,"store_name": string | null,"xp": number | null
                  }
                  Insert: {
                           "account_type"?: Database["public"]['Enums']["account_type"] | null,"avatar_media_id"?: string | null,"banner_media_id"?: string | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"handle"?: string | null,"id"?: string | null,"is_pro"?: never,"level"?: number | null,"rating_avg"?: number | null,"rating_count"?: number | null,"store_name"?: string | null,"xp"?: number | null
                         }
                        Update: {
                           "account_type"?: Database["public"]['Enums']["account_type"] | null,"avatar_media_id"?: string | null,"banner_media_id"?: string | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"handle"?: string | null,"id"?: string | null,"is_pro"?: never,"level"?: number | null,"rating_avg"?: number | null,"rating_count"?: number | null,"store_name"?: string | null,"xp"?: number | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "profiles_banner_media_id_fkey"
      columns: ["banner_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
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
            "admin_adjust_tokens":
{ Args: { "p_delta": number,"p_note"?: string,"p_user": string }; Returns: {
              "balance_after": number,
"created_at": string,
"delta": number,
"id": string,
"idempotency_key": string | null,
"reason": Database["public"]['Enums']["token_ledger_reason"],
"ref_id": string | null,
"ref_type": string | null,
"source": Database["public"]['Enums']["token_ledger_source"] | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "token_ledger"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_search_users":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "account_type": Database["public"]['Enums']["account_type"],
"age_confirmed_at": string | null,
"banner_media_id": string | null,
"bio": string | null,
"city": string | null,
"country_code": string,
"created_at": string,
"deleted_at": string | null,
"display_name": string,
"handle": string,
"handle_changed_at": string | null,
"id": string,
"level": number,
"location": string | null,
"mobile": string | null,
"onboarding_completed_at": string | null,
"photo_url": string | null,
"plan": Database["public"]['Enums']["plan_tier"],
"pro_until": string | null,
"rating_avg": number | null,
"rating_count": number,
"role": Database["public"]['Enums']["user_role"],
"scan_quota_bonus": number,
"scan_quota_reset_at": string,
"scan_quota_used": number,
"store_name": string | null,
"suspended_until": string | null,
"terms_version": string | null,
"tokens": number,
"tutorial_dismissed_at": string | null,
"updated_at": string,
"xp": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: false
        isSetofReturn: true
      } },
"admin_set_suspension":
{ Args: { "p_days"?: number,"p_user_id": string }; Returns: {
              "account_type": Database["public"]['Enums']["account_type"],
"age_confirmed_at": string | null,
"banner_media_id": string | null,
"bio": string | null,
"city": string | null,
"country_code": string,
"created_at": string,
"deleted_at": string | null,
"display_name": string,
"handle": string,
"handle_changed_at": string | null,
"id": string,
"level": number,
"location": string | null,
"mobile": string | null,
"onboarding_completed_at": string | null,
"photo_url": string | null,
"plan": Database["public"]['Enums']["plan_tier"],
"pro_until": string | null,
"rating_avg": number | null,
"rating_count": number,
"role": Database["public"]['Enums']["user_role"],
"scan_quota_bonus": number,
"scan_quota_reset_at": string,
"scan_quota_used": number,
"store_name": string | null,
"suspended_until": string | null,
"terms_version": string | null,
"tokens": number,
"tutorial_dismissed_at": string | null,
"updated_at": string,
"xp": number
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"apply_gamification":
{ Args: { "p_badges"?: Json,"p_level": number,"p_user": string,"p_xp": number }; Returns: Json
                           },
"blocked_users":
{ Args: Record<PropertyKey, never>; Returns: {
              "blocked_id": string,"created_at": string,"display_name": string,"handle": string
            }[]
                           },
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
"buy_world_item":
{ Args: { "p_item_id": string,"p_key"?: string }; Returns: {
              "acquired_via": Database["public"]['Enums']["world_acquired_via"],
"created_at": string,
"durable": boolean,
"id": string,
"item_id": string,
"ledger_id": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "world_inventory"
        isOneToOne: true
        isSetofReturn: false
      } },
"buy_world_level":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,
"extra_slots": number,
"featured_item_id": string | null,
"layout": NonNullable<Json>,
"level": number,
"name": string,
"open_mode": Database["public"]['Enums']["world_open_mode"],
"rename_count": number,
"score": number,
"theme_item_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "world_garages"
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
"credit_tokens":
{ Args: { "p_delta": number,"p_key"?: string,"p_reason": Database["public"]['Enums']["token_ledger_reason"],"p_ref_id"?: string,"p_ref_type"?: string,"p_user": string }; Returns: {
              "balance_after": number,
"created_at": string,
"delta": number,
"id": string,
"idempotency_key": string | null,
"reason": Database["public"]['Enums']["token_ledger_reason"],
"ref_id": string | null,
"ref_type": string | null,
"source": Database["public"]['Enums']["token_ledger_source"] | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "token_ledger"
        isOneToOne: true
        isSetofReturn: false
      } },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"delete_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"emit_event":
{ Args: { "p_actor_id": string,"p_entity": string,"p_entity_id"?: string,"p_payload"?: Json,"p_type": string }; Returns: undefined
                           },
"ensure_world_garage":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,
"extra_slots": number,
"featured_item_id": string | null,
"layout": NonNullable<Json>,
"level": number,
"name": string,
"open_mode": Database["public"]['Enums']["world_open_mode"],
"rename_count": number,
"score": number,
"theme_item_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "world_garages"
        isOneToOne: true
        isSetofReturn: false
      } },
"entitlement_listing_slots":
{ Args: { "p_user": string }; Returns: number
                           },
"entitlement_scan_quota":
{ Args: { "p_user": string }; Returns: number
                           },
"gamification_events":
{ Args: { "p_user"?: string }; Returns: {
              "actor_id": string,"entity": string,"entity_id": string,"id": number,"occurred_at": string,"payload": Json,"type": string
            }[]
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
"mv_is_backend_caller":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"redeem_invite":
{ Args: { "p_code": string }; Returns: undefined
                           },
"rename_world_garage":
{ Args: { "p_name": string }; Returns: {
              "created_at": string,
"extra_slots": number,
"featured_item_id": string | null,
"layout": NonNullable<Json>,
"level": number,
"name": string,
"open_mode": Database["public"]['Enums']["world_open_mode"],
"rename_count": number,
"score": number,
"theme_item_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "world_garages"
        isOneToOne: true
        isSetofReturn: false
      } },
"resolve_report":
{ Args: { "p_action": string,"p_report_id": string,"p_resolution_note"?: string }; Returns: {
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
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"spend_tokens":
{ Args: { "p_cost": number,"p_expires_at"?: string,"p_grant_kind": Database["public"]['Enums']["entitlement_grant_kind"],"p_key"?: string,"p_quantity"?: number,"p_reason": Database["public"]['Enums']["token_ledger_reason"],"p_ref_id"?: string,"p_ref_type"?: string }; Returns: {
              "created_at": string,
"expires_at": string | null,
"id": string,
"kind": Database["public"]['Enums']["entitlement_grant_kind"],
"ledger_id": string | null,
"quantity": number,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "entitlement_grants"
        isOneToOne: true
        isSetofReturn: false
      } },
"token_ledger_source_for":
{ Args: { "p_reason": Database["public"]['Enums']["token_ledger_reason"] }; Returns: Database["public"]['Enums']["token_ledger_source"]
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
      } },
"world_remove_item_from_garage":
{ Args: { "p_item": string,"p_user": string }; Returns: boolean
                           }
          }
          Enums: {
            "account_type": "individual"|"shop","catalog_status": "proposed"|"verified","entitlement_grant_kind": "listing_slot"|"scan_pack"|"pro_30d"|"world_level"|"world_item","feedback_kind": "bug"|"idea"|"other","item_condition": "mint"|"near-mint"|"good"|"played"|"damaged","item_packaging": "carded"|"blister"|"loose"|"boxed","item_rarity": "common"|"uncommon"|"rare"|"super-rare"|"treasure-hunt"|"chase","listing_status": "active"|"sold"|"removed"|"reserved","listing_type": "sale"|"trade"|"both","media_kind": "item"|"avatar"|"banner"|"listing"|"chat","media_status": "uploading"|"ready"|"flagged"|"removed","model_status": "proposed"|"verified"|"merged","notification_type": "offer_received"|"offer_accepted"|"offer_declined"|"message"|"listing_sold"|"review_received"|"badge_unlocked"|"wishlist_match"|"system","offer_status": "pending"|"accepted"|"declined"|"withdrawn"|"expired"|"completed"|"cancelled","offer_type": "cash"|"buy_now"|"trade","plan_tier": "free"|"pro","report_status": "open"|"reviewed"|"dismissed","scan_kind": "single"|"group"|"visual_search","scan_status": "queued"|"running"|"done"|"failed","token_ledger_reason": "purchase"|"spend_listing_slot"|"spend_scan_pack"|"spend_pro_30d"|"refund"|"admin_adjust"|"promo"|"earn_quest"|"earn_daily"|"earn_race_participation"|"earn_host"|"earn_attend"|"earn_achievement"|"earn_referral"|"earn_season"|"expire_earned"|"spend_garage_level"|"spend_world_item"|"spend_meetup_host"|"spend_race_entry"|"spend_spotlight"|"spend_rename","token_ledger_source": "purchased"|"earned"|"promo"|"adjust","token_purchase_provider": "stripe"|"razorpay","token_purchase_status": "created"|"paid"|"failed"|"refunded","user_role": "user"|"admin","world_acquired_via": "purchase"|"earn"|"promo","world_item_kind": "decor"|"theme"|"tune"|"trophy"|"consumable"|"signage","world_open_mode": "public"|"followers"|"invite"
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
            "account_type": ["individual", "shop"],"catalog_status": ["proposed", "verified"],"entitlement_grant_kind": ["listing_slot", "scan_pack", "pro_30d", "world_level", "world_item"],"feedback_kind": ["bug", "idea", "other"],"item_condition": ["mint", "near-mint", "good", "played", "damaged"],"item_packaging": ["carded", "blister", "loose", "boxed"],"item_rarity": ["common", "uncommon", "rare", "super-rare", "treasure-hunt", "chase"],"listing_status": ["active", "sold", "removed", "reserved"],"listing_type": ["sale", "trade", "both"],"media_kind": ["item", "avatar", "banner", "listing", "chat"],"media_status": ["uploading", "ready", "flagged", "removed"],"model_status": ["proposed", "verified", "merged"],"notification_type": ["offer_received", "offer_accepted", "offer_declined", "message", "listing_sold", "review_received", "badge_unlocked", "wishlist_match", "system"],"offer_status": ["pending", "accepted", "declined", "withdrawn", "expired", "completed", "cancelled"],"offer_type": ["cash", "buy_now", "trade"],"plan_tier": ["free", "pro"],"report_status": ["open", "reviewed", "dismissed"],"scan_kind": ["single", "group", "visual_search"],"scan_status": ["queued", "running", "done", "failed"],"token_ledger_reason": ["purchase", "spend_listing_slot", "spend_scan_pack", "spend_pro_30d", "refund", "admin_adjust", "promo", "earn_quest", "earn_daily", "earn_race_participation", "earn_host", "earn_attend", "earn_achievement", "earn_referral", "earn_season", "expire_earned", "spend_garage_level", "spend_world_item", "spend_meetup_host", "spend_race_entry", "spend_spotlight", "spend_rename"],"token_ledger_source": ["purchased", "earned", "promo", "adjust"],"token_purchase_provider": ["stripe", "razorpay"],"token_purchase_status": ["created", "paid", "failed", "refunded"],"user_role": ["user", "admin"],"world_acquired_via": ["purchase", "earn", "promo"],"world_item_kind": ["decor", "theme", "tune", "trophy", "consumable", "signage"],"world_open_mode": ["public", "followers", "invite"]
          }
        }
} as const

