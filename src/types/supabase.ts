
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
                },"analytics_cursors": {
                  Row: {
                    "last_event_id": number,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "last_event_id"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "last_event_id"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_cursors_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "analytics_cursors_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
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
                    "brand_id": string,"casting_code": string | null,"color_variants": NonNullable<Json>,"created_at": string,"id": string,"merged_into_id": string | null,"name": string,"proposed_by": string | null,"scale": string | null,"search": unknown,"series": string | null,"specs": NonNullable<Json>,"specs_proposed_by": string | null,"specs_source": string | null,"specs_verified_at": string | null,"specs_verified_by": string | null,"status": Database["public"]['Enums']["model_status"],"verified_by": string | null,"year": number | null
                  }
                  Insert: {
                    "brand_id": string,"casting_code"?: string | null,"color_variants"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"merged_into_id"?: string | null,"name": string,"proposed_by"?: string | null,"scale"?: string | null,"search"?: never,"series"?: string | null,"specs"?: NonNullable<Json>,"specs_proposed_by"?: string | null,"specs_source"?: string | null,"specs_verified_at"?: string | null,"specs_verified_by"?: string | null,"status"?: Database["public"]['Enums']["model_status"],"verified_by"?: string | null,"year"?: number | null
                  }
                  Update: {
                    "brand_id"?: string,"casting_code"?: string | null,"color_variants"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"merged_into_id"?: string | null,"name"?: string,"proposed_by"?: string | null,"scale"?: string | null,"search"?: never,"series"?: string | null,"specs"?: NonNullable<Json>,"specs_proposed_by"?: string | null,"specs_source"?: string | null,"specs_verified_at"?: string | null,"specs_verified_by"?: string | null,"status"?: Database["public"]['Enums']["model_status"],"verified_by"?: string | null,"year"?: number | null
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
      foreignKeyName: "catalog_models_specs_proposed_by_fkey"
      columns: ["specs_proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_models_specs_proposed_by_fkey"
      columns: ["specs_proposed_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_models_specs_verified_by_fkey"
      columns: ["specs_verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_models_specs_verified_by_fkey"
      columns: ["specs_verified_by"]
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
                },"club_members": {
                  Row: {
                    "club_id": string,"invited_by": string | null,"joined_at": string,"role": Database["public"]['Enums']["club_member_role"],"status": Database["public"]['Enums']["club_member_status"],"user_id": string
                  }
                  Insert: {
                    "club_id": string,"invited_by"?: string | null,"joined_at"?: string,"role"?: Database["public"]['Enums']["club_member_role"],"status"?: Database["public"]['Enums']["club_member_status"],"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"invited_by"?: string | null,"joined_at"?: string,"role"?: Database["public"]['Enums']["club_member_role"],"status"?: Database["public"]['Enums']["club_member_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_members_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_members_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_members_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"club_night_templates": {
                  Row: {
                    "active": boolean,"cadence": string,"capacity": number,"club_id": string,"created_at": string,"duration_minutes": number,"host_id": string,"id": string,"last_meetup_id": string | null,"next_starts_at": string,"theme": string | null,"title": string,"updated_at": string,"visibility": Database["public"]['Enums']["meetup_visibility"]
                  }
                  Insert: {
                    "active"?: boolean,"cadence": string,"capacity": number,"club_id": string,"created_at"?: string,"duration_minutes"?: number,"host_id": string,"id"?: string,"last_meetup_id"?: string | null,"next_starts_at": string,"theme"?: string | null,"title": string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["meetup_visibility"]
                  }
                  Update: {
                    "active"?: boolean,"cadence"?: string,"capacity"?: number,"club_id"?: string,"created_at"?: string,"duration_minutes"?: number,"host_id"?: string,"id"?: string,"last_meetup_id"?: string | null,"next_starts_at"?: string,"theme"?: string | null,"title"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["meetup_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_night_templates_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_night_templates_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_night_templates_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_night_templates_last_meetup_id_fkey"
      columns: ["last_meetup_id"]
isOneToOne: false
      referencedRelation: "meetups"
      referencedColumns: ["id"]
    }
                  ]
                },"clubs": {
                  Row: {
                    "banner_media_id": string | null,"country_code": string | null,"created_at": string,"description": string | null,"id": string,"join_mode": Database["public"]['Enums']["club_join_mode"],"name": string,"owner_id": string,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "banner_media_id"?: string | null,"country_code"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"join_mode"?: Database["public"]['Enums']["club_join_mode"],"name": string,"owner_id": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "banner_media_id"?: string | null,"country_code"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"join_mode"?: Database["public"]['Enums']["club_join_mode"],"name"?: string,"owner_id"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clubs_banner_media_id_fkey"
      columns: ["banner_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clubs_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "clubs_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clubs_owner_id_fkey"
      columns: ["owner_id"]
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
                    "body": string,"created_at": string,"id": string,"kind": string,"meetup_id": string | null,"offer_id": string | null,"reaction": string | null,"read_at": string | null,"sender_id": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"kind"?: string,"meetup_id"?: string | null,"offer_id"?: string | null,"reaction"?: string | null,"read_at"?: string | null,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"meetup_id"?: string | null,"offer_id"?: string | null,"reaction"?: string | null,"read_at"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deal_messages_meetup_id_fkey"
      columns: ["meetup_id"]
isOneToOne: false
      referencedRelation: "meetups"
      referencedColumns: ["id"]
    },{
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
                },"invite_redemptions": {
                  Row: {
                    "code": string,"cohort": string | null,"redeemed_at": string,"user_id": string
                  }
                  Insert: {
                    "code": string,"cohort"?: string | null,"redeemed_at"?: string,"user_id": string
                  }
                  Update: {
                    "code"?: string,"cohort"?: string | null,"redeemed_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invite_redemptions_code_fkey"
      columns: ["code"]
isOneToOne: false
      referencedRelation: "invites"
      referencedColumns: ["code"]
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
                },"job_runs": {
                  Row: {
                    "error": string | null,"finished_at": string | null,"id": number,"job": string,"result": NonNullable<Json>,"run_at": string,"started_at": string,"status": string,"triggered_by": string
                  }
                  Insert: {
                    "error"?: string | null,"finished_at"?: string | null,"id"?: never,"job": string,"result"?: NonNullable<Json>,"run_at": string,"started_at"?: string,"status"?: string,"triggered_by"?: string
                  }
                  Update: {
                    "error"?: string | null,"finished_at"?: string | null,"id"?: never,"job"?: string,"result"?: NonNullable<Json>,"run_at"?: string,"started_at"?: string,"status"?: string,"triggered_by"?: string
                  }
                  Relationships: [
                    
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
                },"meetup_invites": {
                  Row: {
                    "created_at": string,"invited_by": string | null,"meetup_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"invited_by"?: string | null,"meetup_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"invited_by"?: string | null,"meetup_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetup_invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_invites_meetup_id_fkey"
      columns: ["meetup_id"]
isOneToOne: false
      referencedRelation: "meetups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_invites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_invites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"meetup_rsvps": {
                  Row: {
                    "attended_at": string | null,"checked_in_at": string | null,"created_at": string,"meetup_id": string,"muted_at": string | null,"removed_at": string | null,"role": string,"room_joined_at": string | null,"room_seconds": number,"room_seen_at": string | null,"status": Database["public"]['Enums']["meetup_rsvp_status"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "attended_at"?: string | null,"checked_in_at"?: string | null,"created_at"?: string,"meetup_id": string,"muted_at"?: string | null,"removed_at"?: string | null,"role"?: string,"room_joined_at"?: string | null,"room_seconds"?: number,"room_seen_at"?: string | null,"status"?: Database["public"]['Enums']["meetup_rsvp_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "attended_at"?: string | null,"checked_in_at"?: string | null,"created_at"?: string,"meetup_id"?: string,"muted_at"?: string | null,"removed_at"?: string | null,"role"?: string,"room_joined_at"?: string | null,"room_seconds"?: number,"room_seen_at"?: string | null,"status"?: Database["public"]['Enums']["meetup_rsvp_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetup_rsvps_meetup_id_fkey"
      columns: ["meetup_id"]
isOneToOne: false
      referencedRelation: "meetups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_rsvps_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_rsvps_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"meetup_showcase": {
                  Row: {
                    "created_at": string,"id": string,"item_id": string,"meetup_id": string,"position": number,"user_id": string,"votes": number
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"item_id": string,"meetup_id": string,"position"?: number,"user_id": string,"votes"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"item_id"?: string,"meetup_id"?: string,"position"?: number,"user_id"?: string,"votes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetup_showcase_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "collection_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_showcase_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "collection_items_v1"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_showcase_meetup_id_fkey"
      columns: ["meetup_id"]
isOneToOne: false
      referencedRelation: "meetups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_showcase_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_showcase_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"meetup_votes": {
                  Row: {
                    "created_at": string,"meetup_id": string,"showcase_id": string,"updated_at": string,"voter_id": string
                  }
                  Insert: {
                    "created_at"?: string,"meetup_id": string,"showcase_id": string,"updated_at"?: string,"voter_id": string
                  }
                  Update: {
                    "created_at"?: string,"meetup_id"?: string,"showcase_id"?: string,"updated_at"?: string,"voter_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetup_votes_meetup_id_fkey"
      columns: ["meetup_id"]
isOneToOne: false
      referencedRelation: "meetups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_votes_showcase_id_fkey"
      columns: ["showcase_id"]
isOneToOne: false
      referencedRelation: "meetup_showcase"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_votes_voter_id_fkey"
      columns: ["voter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_votes_voter_id_fkey"
      columns: ["voter_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"meetups": {
                  Row: {
                    "best_in_show_id": string | null,"best_in_show_votes": number | null,"cancelled_at": string | null,"capacity": number,"club_id": string | null,"created_at": string,"description": string | null,"ended_at": string | null,"ends_at": string,"fee_ledger_id": string | null,"fee_paid": number,"garage_user_id": string | null,"host_id": string,"id": string,"kind": Database["public"]['Enums']["meetup_kind"],"refund_ledger_id": string | null,"scheduled_at": string | null,"showcase_limit": number,"started_at": string | null,"starts_at": string,"status": Database["public"]['Enums']["meetup_status"],"theme": string | null,"title": string,"updated_at": string,"visibility": Database["public"]['Enums']["meetup_visibility"]
                  }
                  Insert: {
                    "best_in_show_id"?: string | null,"best_in_show_votes"?: number | null,"cancelled_at"?: string | null,"capacity": number,"club_id"?: string | null,"created_at"?: string,"description"?: string | null,"ended_at"?: string | null,"ends_at": string,"fee_ledger_id"?: string | null,"fee_paid"?: number,"garage_user_id"?: string | null,"host_id": string,"id"?: string,"kind"?: Database["public"]['Enums']["meetup_kind"],"refund_ledger_id"?: string | null,"scheduled_at"?: string | null,"showcase_limit"?: number,"started_at"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["meetup_status"],"theme"?: string | null,"title": string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["meetup_visibility"]
                  }
                  Update: {
                    "best_in_show_id"?: string | null,"best_in_show_votes"?: number | null,"cancelled_at"?: string | null,"capacity"?: number,"club_id"?: string | null,"created_at"?: string,"description"?: string | null,"ended_at"?: string | null,"ends_at"?: string,"fee_ledger_id"?: string | null,"fee_paid"?: number,"garage_user_id"?: string | null,"host_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["meetup_kind"],"refund_ledger_id"?: string | null,"scheduled_at"?: string | null,"showcase_limit"?: number,"started_at"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["meetup_status"],"theme"?: string | null,"title"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["meetup_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetups_best_in_show_id_fkey"
      columns: ["best_in_show_id"]
isOneToOne: false
      referencedRelation: "meetup_showcase"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetups_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetups_fee_ledger_id_fkey"
      columns: ["fee_ledger_id"]
isOneToOne: false
      referencedRelation: "token_ledger"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetups_garage_user_id_fkey"
      columns: ["garage_user_id"]
isOneToOne: false
      referencedRelation: "world_garages"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "meetups_garage_user_id_fkey"
      columns: ["garage_user_id"]
isOneToOne: false
      referencedRelation: "world_open_garages"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "meetups_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetups_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetups_refund_ledger_id_fkey"
      columns: ["refund_ledger_id"]
isOneToOne: false
      referencedRelation: "token_ledger"
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
                    "account_type": Database["public"]['Enums']["account_type"],"age_confirmed_at": string | null,"banner_media_id": string | null,"bio": string | null,"city": string | null,"country_code": string,"created_at": string,"deleted_at": string | null,"display_name": string,"handle": string,"handle_changed_at": string | null,"id": string,"level": number,"location": string | null,"mobile": string | null,"onboarding_completed_at": string | null,"photo_url": string | null,"plan": Database["public"]['Enums']["plan_tier"],"pro_until": string | null,"purged_at": string | null,"rating_avg": number | null,"rating_count": number,"role": Database["public"]['Enums']["user_role"],"scan_quota_bonus": number,"scan_quota_reset_at": string,"scan_quota_used": number,"store_name": string | null,"suspended_until": string | null,"terms_version": string | null,"tokens": number,"tutorial_dismissed_at": string | null,"updated_at": string,"xp": number
                  }
                  Insert: {
                    "account_type": Database["public"]['Enums']["account_type"],"age_confirmed_at"?: string | null,"banner_media_id"?: string | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string,"created_at"?: string,"deleted_at"?: string | null,"display_name": string,"handle": string,"handle_changed_at"?: string | null,"id": string,"level"?: number,"location"?: string | null,"mobile"?: string | null,"onboarding_completed_at"?: string | null,"photo_url"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"pro_until"?: string | null,"purged_at"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"role"?: Database["public"]['Enums']["user_role"],"scan_quota_bonus"?: number,"scan_quota_reset_at"?: string,"scan_quota_used"?: number,"store_name"?: string | null,"suspended_until"?: string | null,"terms_version"?: string | null,"tokens"?: number,"tutorial_dismissed_at"?: string | null,"updated_at"?: string,"xp"?: number
                  }
                  Update: {
                    "account_type"?: Database["public"]['Enums']["account_type"],"age_confirmed_at"?: string | null,"banner_media_id"?: string | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string,"handle"?: string,"handle_changed_at"?: string | null,"id"?: string,"level"?: number,"location"?: string | null,"mobile"?: string | null,"onboarding_completed_at"?: string | null,"photo_url"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"pro_until"?: string | null,"purged_at"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"role"?: Database["public"]['Enums']["user_role"],"scan_quota_bonus"?: number,"scan_quota_reset_at"?: string,"scan_quota_used"?: number,"store_name"?: string | null,"suspended_until"?: string | null,"terms_version"?: string | null,"tokens"?: number,"tutorial_dismissed_at"?: string | null,"updated_at"?: string,"xp"?: number
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
                },"quest_progress": {
                  Row: {
                    "completed_at": string | null,"period_start": string,"progress": number,"quest_key": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"period_start": string,"progress"?: number,"quest_key": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"period_start"?: string,"progress"?: number,"quest_key"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quest_progress_quest_key_fkey"
      columns: ["quest_key"]
isOneToOne: false
      referencedRelation: "quests"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "quest_progress_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quest_progress_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quests": {
                  Row: {
                    "active": boolean,"cadence": Database["public"]['Enums']["quest_cadence"],"created_at": string,"description": string | null,"key": string,"reward_credits": number,"reward_item_id": string | null,"reward_xp": number,"rule": NonNullable<Json>,"sort_order": number,"title": string
                  }
                  Insert: {
                    "active"?: boolean,"cadence": Database["public"]['Enums']["quest_cadence"],"created_at"?: string,"description"?: string | null,"key": string,"reward_credits"?: number,"reward_item_id"?: string | null,"reward_xp"?: number,"rule": NonNullable<Json>,"sort_order"?: number,"title": string
                  }
                  Update: {
                    "active"?: boolean,"cadence"?: Database["public"]['Enums']["quest_cadence"],"created_at"?: string,"description"?: string | null,"key"?: string,"reward_credits"?: number,"reward_item_id"?: string | null,"reward_xp"?: number,"rule"?: NonNullable<Json>,"sort_order"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quests_reward_item_id_fkey"
      columns: ["reward_item_id"]
isOneToOne: false
      referencedRelation: "world_items"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"id": string,"notes": string | null,"reason": string | null,"reporter_id": string,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string | null,"target_name": string | null,"target_type": string,"target_user_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"notes"?: string | null,"reason"?: string | null,"reporter_id": string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string | null,"target_name"?: string | null,"target_type": string,"target_user_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"notes"?: string | null,"reason"?: string | null,"reporter_id"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string | null,"target_name"?: string | null,"target_type"?: string,"target_user_id"?: string | null,"updated_at"?: string
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
    },{
      foreignKeyName: "reports_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"season_points": {
                  Row: {
                    "points": number,"season_id": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "points"?: number,"season_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "points"?: number,"season_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "season_points_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_points_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_points_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seasons": {
                  Row: {
                    "announced_at": string | null,"closed_at": string | null,"created_at": string,"ends_at": string,"id": string,"name": string,"starts_at": string,"theme": string | null,"track": NonNullable<Json>
                  }
                  Insert: {
                    "announced_at"?: string | null,"closed_at"?: string | null,"created_at"?: string,"ends_at": string,"id"?: string,"name": string,"starts_at": string,"theme"?: string | null,"track"?: NonNullable<Json>
                  }
                  Update: {
                    "announced_at"?: string | null,"closed_at"?: string | null,"created_at"?: string,"ends_at"?: string,"id"?: string,"name"?: string,"starts_at"?: string,"theme"?: string | null,"track"?: NonNullable<Json>
                  }
                  Relationships: [
                    
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
                    "balance_after": number,"consumed_earned": number | null,"created_at": string,"delta": number,"id": string,"idempotency_key": string | null,"reason": Database["public"]['Enums']["token_ledger_reason"],"ref_id": string | null,"ref_type": string | null,"remaining": number | null,"source": Database["public"]['Enums']["token_ledger_source"] | null,"user_id": string
                  }
                  Insert: {
                    "balance_after": number,"consumed_earned"?: number | null,"created_at"?: string,"delta": number,"id"?: string,"idempotency_key"?: string | null,"reason": Database["public"]['Enums']["token_ledger_reason"],"ref_id"?: string | null,"ref_type"?: string | null,"remaining"?: number | null,"source"?: Database["public"]['Enums']["token_ledger_source"] | null,"user_id": string
                  }
                  Update: {
                    "balance_after"?: number,"consumed_earned"?: number | null,"created_at"?: string,"delta"?: number,"id"?: string,"idempotency_key"?: string | null,"reason"?: Database["public"]['Enums']["token_ledger_reason"],"ref_id"?: string | null,"ref_type"?: string | null,"remaining"?: number | null,"source"?: Database["public"]['Enums']["token_ledger_source"] | null,"user_id"?: string
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
                },"world_earn_freezes": {
                  Row: {
                    "created_at": string,"frozen_by": string | null,"note": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"frozen_by"?: string | null,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"frozen_by"?: string | null,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "world_earn_freezes_frozen_by_fkey"
      columns: ["frozen_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_earn_freezes_frozen_by_fkey"
      columns: ["frozen_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_earn_freezes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_earn_freezes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"world_garages": {
                  Row: {
                    "created_at": string,"extra_slots": number,"featured_item_id": string | null,"kudos_count": number,"layout": NonNullable<Json>,"level": number,"name": string,"open_mode": Database["public"]['Enums']["world_open_mode"],"rename_count": number,"score": number,"theme_item_id": string | null,"updated_at": string,"user_id": string,"visit_count": number
                  }
                  Insert: {
                    "created_at"?: string,"extra_slots"?: number,"featured_item_id"?: string | null,"kudos_count"?: number,"layout"?: NonNullable<Json>,"level"?: number,"name": string,"open_mode"?: Database["public"]['Enums']["world_open_mode"],"rename_count"?: number,"score"?: number,"theme_item_id"?: string | null,"updated_at"?: string,"user_id": string,"visit_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"extra_slots"?: number,"featured_item_id"?: string | null,"kudos_count"?: number,"layout"?: NonNullable<Json>,"level"?: number,"name"?: string,"open_mode"?: Database["public"]['Enums']["world_open_mode"],"rename_count"?: number,"score"?: number,"theme_item_id"?: string | null,"updated_at"?: string,"user_id"?: string,"visit_count"?: number
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
                },"world_guestbook": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"garage_user_id": string,"hidden_at": string | null,"hidden_by_host": boolean,"id": string
                  }
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"garage_user_id": string,"hidden_at"?: string | null,"hidden_by_host"?: boolean,"id"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"garage_user_id"?: string,"hidden_at"?: string | null,"hidden_by_host"?: boolean,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "world_guestbook_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_guestbook_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_guestbook_garage_user_id_fkey"
      columns: ["garage_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_guestbook_garage_user_id_fkey"
      columns: ["garage_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"world_host_suspensions": {
                  Row: {
                    "appeal_note": string | null,"id": string,"lifted_at": string | null,"lifted_by": string | null,"note": string | null,"reason": string,"suspended_at": string,"suspended_by": string | null,"user_id": string
                  }
                  Insert: {
                    "appeal_note"?: string | null,"id"?: string,"lifted_at"?: string | null,"lifted_by"?: string | null,"note"?: string | null,"reason": string,"suspended_at"?: string,"suspended_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "appeal_note"?: string | null,"id"?: string,"lifted_at"?: string | null,"lifted_by"?: string | null,"note"?: string | null,"reason"?: string,"suspended_at"?: string,"suspended_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "world_host_suspensions_lifted_by_fkey"
      columns: ["lifted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_host_suspensions_lifted_by_fkey"
      columns: ["lifted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_host_suspensions_suspended_by_fkey"
      columns: ["suspended_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_host_suspensions_suspended_by_fkey"
      columns: ["suspended_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_host_suspensions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_host_suspensions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"world_inventory": {
                  Row: {
                    "acquired_via": Database["public"]['Enums']["world_acquired_via"],"created_at": string,"durable": boolean,"expires_at": string | null,"id": string,"item_id": string,"ledger_id": string | null,"user_id": string
                  }
                  Insert: {
                    "acquired_via": Database["public"]['Enums']["world_acquired_via"],"created_at"?: string,"durable"?: boolean,"expires_at"?: string | null,"id"?: string,"item_id": string,"ledger_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "acquired_via"?: Database["public"]['Enums']["world_acquired_via"],"created_at"?: string,"durable"?: boolean,"expires_at"?: string | null,"id"?: string,"item_id"?: string,"ledger_id"?: string | null,"user_id"?: string
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
                },"world_invite_uses": {
                  Row: {
                    "created_at": string,"invite_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"invite_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"invite_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "world_invite_uses_invite_id_fkey"
      columns: ["invite_id"]
isOneToOne: false
      referencedRelation: "world_invites"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_invite_uses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_invite_uses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"world_invites": {
                  Row: {
                    "created_at": string,"expires_at": string,"garage_user_id": string,"id": string,"invitee_id": string | null,"max_uses": number,"revoked_at": string | null,"token": string,"used_count": number
                  }
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"garage_user_id": string,"id"?: string,"invitee_id"?: string | null,"max_uses"?: number,"revoked_at"?: string | null,"token"?: string,"used_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"garage_user_id"?: string,"id"?: string,"invitee_id"?: string | null,"max_uses"?: number,"revoked_at"?: string | null,"token"?: string,"used_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "world_invites_garage_user_id_fkey"
      columns: ["garage_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_invites_garage_user_id_fkey"
      columns: ["garage_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_invites_invitee_id_fkey"
      columns: ["invitee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_invites_invitee_id_fkey"
      columns: ["invitee_id"]
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
    },{
      foreignKeyName: "world_items_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"world_kudos": {
                  Row: {
                    "created_at": string,"garage_user_id": string,"given_on": string,"giver_id": string
                  }
                  Insert: {
                    "created_at"?: string,"garage_user_id": string,"given_on"?: string,"giver_id": string
                  }
                  Update: {
                    "created_at"?: string,"garage_user_id"?: string,"given_on"?: string,"giver_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "world_kudos_garage_user_id_fkey"
      columns: ["garage_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_kudos_garage_user_id_fkey"
      columns: ["garage_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_kudos_giver_id_fkey"
      columns: ["giver_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_kudos_giver_id_fkey"
      columns: ["giver_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
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
                },"world_visits": {
                  Row: {
                    "created_at": string,"garage_user_id": string,"id": string,"visited_on": string,"visitor_id": string
                  }
                  Insert: {
                    "created_at"?: string,"garage_user_id": string,"id"?: string,"visited_on"?: string,"visitor_id": string
                  }
                  Update: {
                    "created_at"?: string,"garage_user_id"?: string,"id"?: string,"visited_on"?: string,"visitor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "world_visits_garage_user_id_fkey"
      columns: ["garage_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_visits_garage_user_id_fkey"
      columns: ["garage_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_visits_visitor_id_fkey"
      columns: ["visitor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "world_visits_visitor_id_fkey"
      columns: ["visitor_id"]
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
                },"pilot_kpis_weekly": {
                  Row: {
                    "activated_7d": number | null,"deals_completed": number | null,"deals_reviewed": number | null,"items_added": number | null,"listings_live": number | null,"listings_published": number | null,"offers_created": number | null,"publishers": number | null,"reports_actioned": number | null,"reports_created": number | null,"retained_w4": number | null,"scan_accepted": number | null,"scan_candidates": number | null,"scan_cost_usd": number | null,"scans": number | null,"signups": number | null,"signups_published": number | null,"token_buyers": number | null,"token_purchases": number | null,"token_revenue": Json | null,"wau": number | null,"week_start": string | null
                  }
                  Relationships: [
                    
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
                },"world_open_garages": {
                  Row: {
                    "city": string | null,"country_code": string | null,"display_name": string | null,"featured_item_id": string | null,"handle": string | null,"kudos_count": number | null,"level": number | null,"name": string | null,"score": number | null,"spotlight_until": string | null,"updated_at": string | null,"user_id": string | null,"visit_count": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    },{
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
                }
          }
          Functions: {
            "accept_world_invite":
{ Args: { "p_token": string }; Returns: {
              "created_at": string,
"expires_at": string,
"garage_user_id": string,
"id": string,
"invitee_id": string | null,
"max_uses": number,
"revoked_at": string | null,
"token": string,
"used_count": number
            }
                          SetofOptions: {
        from: "*"
        to: "world_invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_adjust_tokens":
{ Args: { "p_delta": number,"p_note"?: string,"p_user": string }; Returns: {
              "balance_after": number,
"consumed_earned": number | null,
"created_at": string,
"delta": number,
"id": string,
"idempotency_key": string | null,
"reason": Database["public"]['Enums']["token_ledger_reason"],
"ref_id": string | null,
"ref_type": string | null,
"remaining": number | null,
"source": Database["public"]['Enums']["token_ledger_source"] | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "token_ledger"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_overview":
{ Args: Record<PropertyKey, never>; Returns: {
              "deals_completed": number,"feedback_7d": number,"items": number,"listings_active": number,"offers_pending": number,"offers_total": number,"open_reports": number,"phone_users_active_month": number,"scan_cost_usd_month": number,"scans_month": number,"token_purchases_month": number,"token_revenue_month": Json,"users": number,"users_new_7d": number
            }[]
                           },
"admin_pilot_kpis":
{ Args: { "p_weeks"?: number }; Returns: {
              "activated_7d": number | null,
"deals_completed": number | null,
"deals_reviewed": number | null,
"items_added": number | null,
"listings_live": number | null,
"listings_published": number | null,
"offers_created": number | null,
"publishers": number | null,
"reports_actioned": number | null,
"reports_created": number | null,
"retained_w4": number | null,
"scan_accepted": number | null,
"scan_candidates": number | null,
"scan_cost_usd": number | null,
"scans": number | null,
"signups": number | null,
"signups_published": number | null,
"token_buyers": number | null,
"token_purchases": number | null,
"token_revenue": Json | null,
"wau": number | null,
"week_start": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "pilot_kpis_weekly"
        isOneToOne: false
        isSetofReturn: true
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
"purged_at": string | null,
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
"admin_set_earn_freeze":
{ Args: { "p_frozen": boolean,"p_note"?: string,"p_user": string }; Returns: boolean
                           },
"admin_set_host_suspension":
{ Args: { "p_action": string,"p_note"?: string,"p_user": string }; Returns: {
              "appeal_note": string | null,
"id": string,
"lifted_at": string | null,
"lifted_by": string | null,
"note": string | null,
"reason": string,
"suspended_at": string,
"suspended_by": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "world_host_suspensions"
        isOneToOne: true
        isSetofReturn: false
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
"purged_at": string | null,
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
"expires_at": string | null,
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
"kudos_count": number,
"layout": NonNullable<Json>,
"level": number,
"name": string,
"open_mode": Database["public"]['Enums']["world_open_mode"],
"rename_count": number,
"score": number,
"theme_item_id": string | null,
"updated_at": string,
"user_id": string,
"visit_count": number
            }
                          SetofOptions: {
        from: "*"
        to: "world_garages"
        isOneToOne: true
        isSetofReturn: false
      } },
"catalog_specs_valid":
{ Args: { "p": Json }; Returns: boolean
                           },
"claim_analytics_events":
{ Args: { "p_limit"?: number }; Returns: {
              "id": number,"occurred_at": string,"type": string
            }[]
                           },
"club_feed":
{ Args: { "p_club": string,"p_limit"?: number }; Returns: {
              "actor_id": string,"event_id": number,"occurred_at": string,"payload": Json,"type": string
            }[]
                           },
"club_member_counts":
{ Args: { "p_clubs": (string)[] }; Returns: {
              "club_id": string,"members": number
            }[]
                           },
"club_role":
{ Args: { "p_club": string,"p_user": string }; Returns: string
                           },
"create_club":
{ Args: { "p_country"?: string,"p_description"?: string,"p_join_mode"?: Database["public"]['Enums']["club_join_mode"],"p_name": string,"p_slug": string }; Returns: {
              "banner_media_id": string | null,
"country_code": string | null,
"created_at": string,
"description": string | null,
"id": string,
"join_mode": Database["public"]['Enums']["club_join_mode"],
"name": string,
"owner_id": string,
"slug": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "clubs"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_meetup":
{ Args: { "p_capacity": number,"p_club_id"?: string,"p_description"?: string,"p_ends_at": string,"p_starts_at": string,"p_theme"?: string,"p_title": string,"p_visibility"?: Database["public"]['Enums']["meetup_visibility"] }; Returns: {
              "best_in_show_id": string | null,
"best_in_show_votes": number | null,
"cancelled_at": string | null,
"capacity": number,
"club_id": string | null,
"created_at": string,
"description": string | null,
"ended_at": string | null,
"ends_at": string,
"fee_ledger_id": string | null,
"fee_paid": number,
"garage_user_id": string | null,
"host_id": string,
"id": string,
"kind": Database["public"]['Enums']["meetup_kind"],
"refund_ledger_id": string | null,
"scheduled_at": string | null,
"showcase_limit": number,
"started_at": string | null,
"starts_at": string,
"status": Database["public"]['Enums']["meetup_status"],
"theme": string | null,
"title": string,
"updated_at": string,
"visibility": Database["public"]['Enums']["meetup_visibility"]
            }
                          SetofOptions: {
        from: "*"
        to: "meetups"
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
"target_user_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "reports"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_world_invite":
{ Args: { "p_hours"?: number,"p_invitee_handle"?: string,"p_max_uses"?: number }; Returns: {
              "created_at": string,
"expires_at": string,
"garage_user_id": string,
"id": string,
"invitee_id": string | null,
"max_uses": number,
"revoked_at": string | null,
"token": string,
"used_count": number
            }
                          SetofOptions: {
        from: "*"
        to: "world_invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"credit_tokens":
{ Args: { "p_delta": number,"p_key"?: string,"p_reason": Database["public"]['Enums']["token_ledger_reason"],"p_ref_id"?: string,"p_ref_type"?: string,"p_user": string }; Returns: {
              "balance_after": number,
"consumed_earned": number | null,
"created_at": string,
"delta": number,
"id": string,
"idempotency_key": string | null,
"reason": Database["public"]['Enums']["token_ledger_reason"],
"ref_id": string | null,
"ref_type": string | null,
"remaining": number | null,
"source": Database["public"]['Enums']["token_ledger_source"] | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "token_ledger"
        isOneToOne: true
        isSetofReturn: false
      } },
"current_quests":
{ Args: { "p_at"?: string }; Returns: {
              "cadence": Database["public"]['Enums']["quest_cadence"],"description": string,"key": string,"period_end": string,"period_start": string,"reward_credits": number,"reward_item_id": string,"reward_xp": number,"rule": Json,"sort_order": number,"title": string
            }[]
                           },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"decide_club_application":
{ Args: { "p_approve": boolean,"p_club": string,"p_user": string }; Returns: undefined
                           },
"delete_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"earn_tokens":
{ Args: { "p_amount": number,"p_key": string,"p_reason": Database["public"]['Enums']["token_ledger_reason"],"p_user": string }; Returns: {
              "balance_after": number,
"consumed_earned": number | null,
"created_at": string,
"delta": number,
"id": string,
"idempotency_key": string | null,
"reason": Database["public"]['Enums']["token_ledger_reason"],
"ref_id": string | null,
"ref_type": string | null,
"remaining": number | null,
"source": Database["public"]['Enums']["token_ledger_source"] | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "token_ledger"
        isOneToOne: true
        isSetofReturn: false
      } },
"emit_event":
{ Args: { "p_actor_id": string,"p_entity": string,"p_entity_id"?: string,"p_payload"?: Json,"p_type": string }; Returns: undefined
                           },
"ensure_event_partitions":
{ Args: { "p_ahead"?: number,"p_at"?: string }; Returns: Json
                           },
"ensure_world_garage":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,
"extra_slots": number,
"featured_item_id": string | null,
"kudos_count": number,
"layout": NonNullable<Json>,
"level": number,
"name": string,
"open_mode": Database["public"]['Enums']["world_open_mode"],
"rename_count": number,
"score": number,
"theme_item_id": string | null,
"updated_at": string,
"user_id": string,
"visit_count": number
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
"expire_earned_tokens":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"expire_listings":
{ Args: { "p_at"?: string }; Returns: number
                           },
"expire_offers":
{ Args: { "p_at"?: string }; Returns: number
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
"give_world_kudos":
{ Args: { "p_garage": string }; Returns: {
              "created_at": string,
"garage_user_id": string,
"given_on": string,
"giver_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "world_kudos"
        isOneToOne: true
        isSetofReturn: false
      } },
"h1_purge_account_done":
{ Args: { "p_user": string }; Returns: undefined
                           },
"h1_purge_accounts_batch":
{ Args: { "p_at"?: string,"p_grace_days"?: number,"p_limit"?: number }; Returns: {
              "deleted_at": string,"id": string
            }[]
                           },
"h1_purge_media_batch":
{ Args: { "p_limit"?: number }; Returns: {
              "bucket": string,"id": string,"path": string
            }[]
                           },
"h1_purge_media_done":
{ Args: { "p_ids": (string)[] }; Returns: number
                           },
"hide_world_guestbook":
{ Args: { "p_hidden"?: boolean,"p_id": string }; Returns: {
              "author_id": string,
"body": string,
"created_at": string,
"garage_user_id": string,
"hidden_at": string | null,
"hidden_by_host": boolean,
"id": string
            }
                          SetofOptions: {
        from: "*"
        to: "world_guestbook"
        isOneToOne: true
        isSetofReturn: false
      } },
"increment_listing_view":
{ Args: { "p_listing_id": string }; Returns: undefined
                           },
"invite_to_club":
{ Args: { "p_club": string,"p_handle": string }; Returns: {
              "club_id": string,
"invited_by": string | null,
"joined_at": string,
"role": Database["public"]['Enums']["club_member_role"],
"status": Database["public"]['Enums']["club_member_status"],
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "club_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"invite_to_meetup":
{ Args: { "p_handle": string,"p_id": string }; Returns: {
              "created_at": string,
"invited_by": string | null,
"meetup_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "meetup_invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_blocked":
{ Args: { "p_a": string,"p_b": string }; Returns: boolean
                           },
"is_club_member":
{ Args: { "p_club": string,"p_user": string }; Returns: boolean
                           },
"is_club_staff":
{ Args: { "p_club": string,"p_user": string }; Returns: boolean
                           },
"is_meetup_host":
{ Args: { "p_meetup": string,"p_user": string }; Returns: boolean
                           },
"is_pro":
{ Args: { "p_user"?: string }; Returns: boolean
                           },
"job_runs_recent_errors":
{ Args: { "p_since"?: string }; Returns: {
              "error": string,"job": string,"started_at": string,"status": string
            }[]
                           },
"join_club":
{ Args: { "p_club": string }; Returns: {
              "club_id": string,
"invited_by": string | null,
"joined_at": string,
"role": Database["public"]['Enums']["club_member_role"],
"status": Database["public"]['Enums']["club_member_status"],
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "club_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"leave_club":
{ Args: { "p_club": string }; Returns: undefined
                           },
"lock_event_partitions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"match_catalog_models":
{ Args: { "p_limit"?: number,"p_name": string }; Returns: {
              "brand_id": string,"id": string,"name": string,"score": number
            }[]
                           },
"media_is_public":
{ Args: { "p_media_id": string }; Returns: boolean
                           },
"meetup_host_cap":
{ Args: { "p_user": string }; Returns: number
                           },
"meetup_host_fee":
{ Args: { "p_capacity": number }; Returns: number
                           },
"meetup_promote_waitlist":
{ Args: { "p_id": string }; Returns: number
                           },
"meetup_room_member":
{ Args: { "p_meetup": string,"p_user": string }; Returns: boolean
                           },
"meetup_room_ping":
{ Args: { "p_id": string }; Returns: boolean
                           },
"meetup_visible":
{ Args: { "p_meetup": string,"p_viewer": string }; Returns: boolean
                           },
"moderate_club_member":
{ Args: { "p_action": string,"p_club": string,"p_user": string }; Returns: undefined
                           },
"moderate_meetup_attendee":
{ Args: { "p_action": string,"p_id": string,"p_user": string }; Returns: {
              "attended_at": string | null,
"checked_in_at": string | null,
"created_at": string,
"meetup_id": string,
"muted_at": string | null,
"removed_at": string | null,
"role": string,
"room_joined_at": string | null,
"room_seconds": number,
"room_seen_at": string | null,
"status": Database["public"]['Enums']["meetup_rsvp_status"],
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "meetup_rsvps"
        isOneToOne: true
        isSetofReturn: false
      } },
"mv_flag_active":
{ Args: { "p_key": string,"p_user": string }; Returns: boolean
                           },
"mv_is_backend_caller":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mv_stable_bucket":
{ Args: { "p_input": string }; Returns: number
                           },
"mv_utc_day":
{ Args: { "p_at": string }; Returns: string
                           },
"mv_utc_day_start":
{ Args: { "p_day": string }; Returns: string
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"post_world_guestbook":
{ Args: { "p_body": string,"p_garage": string }; Returns: {
              "author_id": string,
"body": string,
"created_at": string,
"garage_user_id": string,
"hidden_at": string | null,
"hidden_by_host": boolean,
"id": string
            }
                          SetofOptions: {
        from: "*"
        to: "world_guestbook"
        isOneToOne: true
        isSetofReturn: false
      } },
"propose_catalog_specs":
{ Args: { "p_model_id": string,"p_source"?: string,"p_specs": Json }; Returns: {
              "brand_id": string,
"casting_code": string | null,
"color_variants": NonNullable<Json>,
"created_at": string,
"id": string,
"merged_into_id": string | null,
"name": string,
"proposed_by": string | null,
"scale": string | null,
"search": unknown,
"series": string | null,
"specs": NonNullable<Json>,
"specs_proposed_by": string | null,
"specs_source": string | null,
"specs_verified_at": string | null,
"specs_verified_by": string | null,
"status": Database["public"]['Enums']["model_status"],
"verified_by": string | null,
"year": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "catalog_models"
        isOneToOne: true
        isSetofReturn: false
      } },
"purge_trash":
{ Args: { "p_at"?: string,"p_days"?: number }; Returns: Json
                           },
"quest_completed_at":
{ Args: { "p_end": string,"p_rule": Json,"p_start": string,"p_user": string }; Returns: string
                           },
"quest_period_end":
{ Args: { "p_cadence": Database["public"]['Enums']["quest_cadence"],"p_start": string }; Returns: string
                           },
"quest_period_start":
{ Args: { "p_at": string,"p_cadence": Database["public"]['Enums']["quest_cadence"] }; Returns: string
                           },
"quest_progress_value":
{ Args: { "p_end": string,"p_rule": Json,"p_start": string,"p_user": string }; Returns: number
                           },
"quest_set_index":
{ Args: { "p_cadence": Database["public"]['Enums']["quest_cadence"],"p_start": string }; Returns: number
                           },
"record_job_run":
{ Args: { "p_error"?: string,"p_job": string,"p_result"?: Json,"p_run_at"?: string,"p_source"?: string,"p_started_at"?: string,"p_status": string }; Returns: {
              "error": string | null,
"finished_at": string | null,
"id": number,
"job": string,
"result": NonNullable<Json>,
"run_at": string,
"started_at": string,
"status": string,
"triggered_by": string
            }
                          SetofOptions: {
        from: "*"
        to: "job_runs"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_scan_accepted":
{ Args: { "p_count": number,"p_job": string }; Returns: number
                           },
"record_world_visit":
{ Args: { "p_garage": string }; Returns: {
              "created_at": string,
"garage_user_id": string,
"id": string,
"visited_on": string,
"visitor_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "world_visits"
        isOneToOne: true
        isSetofReturn: false
      } },
"redeem_invite":
{ Args: { "p_code": string }; Returns: undefined
                           },
"refresh_pilot_kpis":
{ Args: Record<PropertyKey, never>; Returns: {
              "error": string | null,
"finished_at": string | null,
"id": number,
"job": string,
"result": NonNullable<Json>,
"run_at": string,
"started_at": string,
"status": string,
"triggered_by": string
            }
                          SetofOptions: {
        from: "*"
        to: "job_runs"
        isOneToOne: true
        isSetofReturn: false
      } },
"remove_meetup_photo":
{ Args: { "p_media_id": string }; Returns: undefined
                           },
"rename_world_garage":
{ Args: { "p_name": string }; Returns: {
              "created_at": string,
"extra_slots": number,
"featured_item_id": string | null,
"kudos_count": number,
"layout": NonNullable<Json>,
"level": number,
"name": string,
"open_mode": Database["public"]['Enums']["world_open_mode"],
"rename_count": number,
"score": number,
"theme_item_id": string | null,
"updated_at": string,
"user_id": string,
"visit_count": number
            }
                          SetofOptions: {
        from: "*"
        to: "world_garages"
        isOneToOne: true
        isSetofReturn: false
      } },
"replay_quest_progress":
{ Args: { "p_from"?: string,"p_user": string }; Returns: number
                           },
"report_target_user":
{ Args: { "p_target_id": string,"p_target_type": string }; Returns: string
                           },
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
"target_user_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "reports"
        isOneToOne: true
        isSetofReturn: false
      } },
"revoke_world_invite":
{ Args: { "p_id": string }; Returns: {
              "created_at": string,
"expires_at": string,
"garage_user_id": string,
"id": string,
"invitee_id": string | null,
"max_uses": number,
"revoked_at": string | null,
"token": string,
"used_count": number
            }
                          SetofOptions: {
        from: "*"
        to: "world_invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"rollover_season":
{ Args: { "p_at"?: string }; Returns: Json
                           },
"rsvp_meetup":
{ Args: { "p_id": string,"p_status"?: string }; Returns: {
              "attended_at": string | null,
"checked_in_at": string | null,
"created_at": string,
"meetup_id": string,
"muted_at": string | null,
"removed_at": string | null,
"role": string,
"room_joined_at": string | null,
"room_seconds": number,
"room_seen_at": string | null,
"status": Database["public"]['Enums']["meetup_rsvp_status"],
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "meetup_rsvps"
        isOneToOne: true
        isSetofReturn: false
      } },
"run_h1_job":
{ Args: { "p_at"?: string,"p_job": string,"p_source"?: string }; Returns: {
              "error": string | null,
"finished_at": string | null,
"id": number,
"job": string,
"result": NonNullable<Json>,
"run_at": string,
"started_at": string,
"status": string,
"triggered_by": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "job_runs"
        isOneToOne: false
        isSetofReturn: true
      } },
"run_meetup_jobs":
{ Args: { "p_at"?: string,"p_job"?: string,"p_source"?: string }; Returns: {
              "error": string | null,
"finished_at": string | null,
"id": number,
"job": string,
"result": NonNullable<Json>,
"run_at": string,
"started_at": string,
"status": string,
"triggered_by": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "job_runs"
        isOneToOne: false
        isSetofReturn: true
      } },
"run_world_job":
{ Args: { "p_at"?: string,"p_job": string,"p_source"?: string }; Returns: {
              "error": string | null,
"finished_at": string | null,
"id": number,
"job": string,
"result": NonNullable<Json>,
"run_at": string,
"started_at": string,
"status": string,
"triggered_by": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "job_runs"
        isOneToOne: false
        isSetofReturn: true
      } },
"season_track_award":
{ Args: { "p_season": string,"p_user": string }; Returns: number
                           },
"set_club_member_role":
{ Args: { "p_club": string,"p_role": Database["public"]['Enums']["club_member_role"],"p_user": string }; Returns: {
              "club_id": string,
"invited_by": string | null,
"joined_at": string,
"role": Database["public"]['Enums']["club_member_role"],
"status": Database["public"]['Enums']["club_member_status"],
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "club_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_club_night":
{ Args: { "p_cadence": string,"p_capacity": number,"p_club": string,"p_duration": number,"p_first_start": string,"p_theme"?: string,"p_title": string,"p_visibility"?: Database["public"]['Enums']["meetup_visibility"] }; Returns: {
              "active": boolean,
"cadence": string,
"capacity": number,
"club_id": string,
"created_at": string,
"duration_minutes": number,
"host_id": string,
"id": string,
"last_meetup_id": string | null,
"next_starts_at": string,
"theme": string | null,
"title": string,
"updated_at": string,
"visibility": Database["public"]['Enums']["meetup_visibility"]
            }
                          SetofOptions: {
        from: "*"
        to: "club_night_templates"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_meetup_cohost":
{ Args: { "p_handle": string,"p_id": string,"p_on": boolean }; Returns: {
              "attended_at": string | null,
"checked_in_at": string | null,
"created_at": string,
"meetup_id": string,
"muted_at": string | null,
"removed_at": string | null,
"role": string,
"room_joined_at": string | null,
"room_seconds": number,
"room_seen_at": string | null,
"status": Database["public"]['Enums']["meetup_rsvp_status"],
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "meetup_rsvps"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_meetup_showcase":
{ Args: { "p_id": string,"p_item_ids": (string)[] }; Returns: {
              "created_at": string,
"id": string,
"item_id": string,
"meetup_id": string,
"position": number,
"user_id": string,
"votes": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "meetup_showcase"
        isOneToOne: false
        isSetofReturn: true
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
"stop_club_night":
{ Args: { "p_club": string }; Returns: undefined
                           },
"token_consume_fifo":
{ Args: { "p_amount": number,"p_earned_first": boolean,"p_user": string }; Returns: number
                           },
"token_ledger_source_for":
{ Args: { "p_reason": Database["public"]['Enums']["token_ledger_reason"] }; Returns: Database["public"]['Enums']["token_ledger_source"]
                           },
"transition_meetup":
{ Args: { "p_action": string,"p_id": string }; Returns: {
              "best_in_show_id": string | null,
"best_in_show_votes": number | null,
"cancelled_at": string | null,
"capacity": number,
"club_id": string | null,
"created_at": string,
"description": string | null,
"ended_at": string | null,
"ends_at": string,
"fee_ledger_id": string | null,
"fee_paid": number,
"garage_user_id": string | null,
"host_id": string,
"id": string,
"kind": Database["public"]['Enums']["meetup_kind"],
"refund_ledger_id": string | null,
"scheduled_at": string | null,
"showcase_limit": number,
"started_at": string | null,
"starts_at": string,
"status": Database["public"]['Enums']["meetup_status"],
"theme": string | null,
"title": string,
"updated_at": string,
"visibility": Database["public"]['Enums']["meetup_visibility"]
            }
                          SetofOptions: {
        from: "*"
        to: "meetups"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"update_club":
{ Args: { "p_club": string,"p_country"?: string,"p_description"?: string,"p_join_mode": Database["public"]['Enums']["club_join_mode"],"p_name": string }; Returns: {
              "banner_media_id": string | null,
"country_code": string | null,
"created_at": string,
"description": string | null,
"id": string,
"join_mode": Database["public"]['Enums']["club_join_mode"],
"name": string,
"owner_id": string,
"slug": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "clubs"
        isOneToOne: true
        isSetofReturn: false
      } },
"verify_catalog_specs":
{ Args: { "p_model_id": string,"p_source"?: string,"p_specs": Json }; Returns: {
              "brand_id": string,
"casting_code": string | null,
"color_variants": NonNullable<Json>,
"created_at": string,
"id": string,
"merged_into_id": string | null,
"name": string,
"proposed_by": string | null,
"scale": string | null,
"search": unknown,
"series": string | null,
"specs": NonNullable<Json>,
"specs_proposed_by": string | null,
"specs_source": string | null,
"specs_verified_at": string | null,
"specs_verified_by": string | null,
"status": Database["public"]['Enums']["model_status"],
"verified_by": string | null,
"year": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "catalog_models"
        isOneToOne: true
        isSetofReturn: false
      } },
"vote_best_in_show":
{ Args: { "p_id": string,"p_showcase_id": string }; Returns: {
              "created_at": string,
"id": string,
"item_id": string,
"meetup_id": string,
"position": number,
"user_id": string,
"votes": number
            }
                          SetofOptions: {
        from: "*"
        to: "meetup_showcase"
        isOneToOne: true
        isSetofReturn: false
      } },
"world_apply_host_suspension":
{ Args: { "p_report": string,"p_user": string }; Returns: boolean
                           },
"world_bump_counter":
{ Args: { "p_column": string,"p_delta": number,"p_garage": string }; Returns: undefined
                           },
"world_economy_summary":
{ Args: Record<PropertyKey, never>; Returns: {
              "metric": string,"note": string,"value": number
            }[]
                           },
"world_economy_weekly":
{ Args: { "p_weeks"?: number }; Returns: {
              "buyers": number,"earned": number,"earners": number,"expired": number,"purchased": number,"refunded": number,"spenders": number,"spent": number,"spent_from_earned": number,"week_start": string,"world_spent": number
            }[]
                           },
"world_garage_score_value":
{ Args: { "p_user": string }; Returns: number
                           },
"world_garage_visible":
{ Args: { "p_garage": string,"p_viewer": string }; Returns: boolean
                           },
"world_has_invite":
{ Args: { "p_garage": string,"p_viewer": string }; Returns: boolean
                           },
"world_host_ineligible_reason":
{ Args: { "p_user"?: string }; Returns: string
                           },
"world_job_club_nights":
{ Args: { "p_at"?: string }; Returns: Json
                           },
"world_job_earned_expiry_notice":
{ Args: { "p_at"?: string }; Returns: Json
                           },
"world_job_meetup_reminders":
{ Args: { "p_at"?: string }; Returns: Json
                           },
"world_job_meetup_transitions":
{ Args: { "p_at"?: string }; Returns: Json
                           },
"world_job_quest_reset":
{ Args: { "p_at"?: string }; Returns: Json
                           },
"world_login_streak":
{ Args: { "p_day"?: string,"p_user": string }; Returns: number
                           },
"world_quest_complete":
{ Args: { "p_at": string,"p_cadence": Database["public"]['Enums']["quest_cadence"],"p_key": string,"p_period_start": string,"p_reward_credits": number,"p_reward_item_id": string,"p_reward_xp": number,"p_user": string }; Returns: undefined
                           },
"world_recompute_all_scores":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"world_recompute_score":
{ Args: { "p_user": string }; Returns: number
                           },
"world_remove_item_from_garage":
{ Args: { "p_item": string,"p_user": string }; Returns: boolean
                           }
          }
          Enums: {
            "account_type": "individual"|"shop","catalog_status": "proposed"|"verified","club_join_mode": "open"|"apply"|"invite","club_member_role": "owner"|"admin"|"member","club_member_status": "active"|"pending"|"banned","entitlement_grant_kind": "listing_slot"|"scan_pack"|"pro_30d"|"world_level"|"world_item"|"meetup_host","feedback_kind": "bug"|"idea"|"other","item_condition": "mint"|"near-mint"|"good"|"played"|"damaged","item_packaging": "carded"|"blister"|"loose"|"boxed","item_rarity": "common"|"uncommon"|"rare"|"super-rare"|"treasure-hunt"|"chase","listing_status": "active"|"sold"|"removed"|"reserved"|"expired","listing_type": "sale"|"trade"|"both","media_kind": "item"|"avatar"|"banner"|"listing"|"chat"|"meetup_photo","media_status": "uploading"|"ready"|"flagged"|"removed","meetup_kind": "virtual"|"in_person","meetup_rsvp_status": "going"|"waitlist"|"declined"|"checked_in","meetup_status": "draft"|"scheduled"|"live"|"ended"|"cancelled","meetup_visibility": "public"|"followers"|"club"|"invite","model_status": "proposed"|"verified"|"merged","notification_type": "offer_received"|"offer_accepted"|"offer_declined"|"message"|"listing_sold"|"review_received"|"badge_unlocked"|"wishlist_match"|"system"|"world_visit"|"world_kudos"|"world_guestbook"|"world_invite"|"tokens_expiring"|"listing_expired"|"offer_expired"|"meetup_invite"|"meetup_reminder"|"meetup_live"|"meetup_cancelled"|"club_invite"|"club_approved"|"club_night_ready"|"hosting_suspended"|"feedback_received","offer_status": "pending"|"accepted"|"declined"|"withdrawn"|"expired"|"completed"|"cancelled","offer_type": "cash"|"buy_now"|"trade","plan_tier": "free"|"pro","quest_cadence": "daily"|"weekly","report_status": "open"|"reviewed"|"dismissed","scan_kind": "single"|"group"|"visual_search","scan_status": "queued"|"running"|"done"|"failed","token_ledger_reason": "purchase"|"spend_listing_slot"|"spend_scan_pack"|"spend_pro_30d"|"refund"|"admin_adjust"|"promo"|"earn_quest"|"earn_daily"|"earn_race_participation"|"earn_host"|"earn_attend"|"earn_achievement"|"earn_referral"|"earn_season"|"expire_earned"|"spend_garage_level"|"spend_world_item"|"spend_meetup_host"|"spend_race_entry"|"spend_spotlight"|"spend_rename","token_ledger_source": "purchased"|"earned"|"promo"|"adjust"|"mixed","token_purchase_provider": "stripe"|"razorpay","token_purchase_status": "created"|"paid"|"failed"|"refunded","user_role": "user"|"admin","world_acquired_via": "purchase"|"earn"|"promo","world_item_kind": "decor"|"theme"|"tune"|"trophy"|"consumable"|"signage","world_open_mode": "public"|"followers"|"invite"
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
            "account_type": ["individual", "shop"],"catalog_status": ["proposed", "verified"],"club_join_mode": ["open", "apply", "invite"],"club_member_role": ["owner", "admin", "member"],"club_member_status": ["active", "pending", "banned"],"entitlement_grant_kind": ["listing_slot", "scan_pack", "pro_30d", "world_level", "world_item", "meetup_host"],"feedback_kind": ["bug", "idea", "other"],"item_condition": ["mint", "near-mint", "good", "played", "damaged"],"item_packaging": ["carded", "blister", "loose", "boxed"],"item_rarity": ["common", "uncommon", "rare", "super-rare", "treasure-hunt", "chase"],"listing_status": ["active", "sold", "removed", "reserved", "expired"],"listing_type": ["sale", "trade", "both"],"media_kind": ["item", "avatar", "banner", "listing", "chat", "meetup_photo"],"media_status": ["uploading", "ready", "flagged", "removed"],"meetup_kind": ["virtual", "in_person"],"meetup_rsvp_status": ["going", "waitlist", "declined", "checked_in"],"meetup_status": ["draft", "scheduled", "live", "ended", "cancelled"],"meetup_visibility": ["public", "followers", "club", "invite"],"model_status": ["proposed", "verified", "merged"],"notification_type": ["offer_received", "offer_accepted", "offer_declined", "message", "listing_sold", "review_received", "badge_unlocked", "wishlist_match", "system", "world_visit", "world_kudos", "world_guestbook", "world_invite", "tokens_expiring", "listing_expired", "offer_expired", "meetup_invite", "meetup_reminder", "meetup_live", "meetup_cancelled", "club_invite", "club_approved", "club_night_ready", "hosting_suspended", "feedback_received"],"offer_status": ["pending", "accepted", "declined", "withdrawn", "expired", "completed", "cancelled"],"offer_type": ["cash", "buy_now", "trade"],"plan_tier": ["free", "pro"],"quest_cadence": ["daily", "weekly"],"report_status": ["open", "reviewed", "dismissed"],"scan_kind": ["single", "group", "visual_search"],"scan_status": ["queued", "running", "done", "failed"],"token_ledger_reason": ["purchase", "spend_listing_slot", "spend_scan_pack", "spend_pro_30d", "refund", "admin_adjust", "promo", "earn_quest", "earn_daily", "earn_race_participation", "earn_host", "earn_attend", "earn_achievement", "earn_referral", "earn_season", "expire_earned", "spend_garage_level", "spend_world_item", "spend_meetup_host", "spend_race_entry", "spend_spotlight", "spend_rename"],"token_ledger_source": ["purchased", "earned", "promo", "adjust", "mixed"],"token_purchase_provider": ["stripe", "razorpay"],"token_purchase_status": ["created", "paid", "failed", "refunded"],"user_role": ["user", "admin"],"world_acquired_via": ["purchase", "earn", "promo"],"world_item_kind": ["decor", "theme", "tune", "trophy", "consumable", "signage"],"world_open_mode": ["public", "followers", "invite"]
          }
        }
} as const

