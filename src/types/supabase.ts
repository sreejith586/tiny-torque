
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "collection_items": {
                  Row: {
                    "ask_price": number | null,"brand": string,"card_type": string | null,"condition": string | null,"created_at": string,"deleted_at": string | null,"for_sale": boolean,"id": string,"is_public": boolean,"model": string | null,"open_to_offers": boolean,"open_to_trade": boolean,"owner_id": string,"photo": string | null,"photos": NonNullable<Json>,"price_paid": number,"qty": number,"rarity": string | null,"scale": string | null,"series": string | null,"source": string | null,"updated_at": string,"variant": string | null
                  }
                  Insert: {
                    "ask_price"?: number | null,"brand": string,"card_type"?: string | null,"condition"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"for_sale"?: boolean,"id"?: string,"is_public"?: boolean,"model"?: string | null,"open_to_offers"?: boolean,"open_to_trade"?: boolean,"owner_id": string,"photo"?: string | null,"photos"?: NonNullable<Json>,"price_paid"?: number,"qty"?: number,"rarity"?: string | null,"scale"?: string | null,"series"?: string | null,"source"?: string | null,"updated_at"?: string,"variant"?: string | null
                  }
                  Update: {
                    "ask_price"?: number | null,"brand"?: string,"card_type"?: string | null,"condition"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"for_sale"?: boolean,"id"?: string,"is_public"?: boolean,"model"?: string | null,"open_to_offers"?: boolean,"open_to_trade"?: boolean,"owner_id"?: string,"photo"?: string | null,"photos"?: NonNullable<Json>,"price_paid"?: number,"qty"?: number,"rarity"?: string | null,"scale"?: string | null,"series"?: string | null,"source"?: string | null,"updated_at"?: string,"variant"?: string | null
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
                },"marketplace_listings": {
                  Row: {
                    "brand": string,"condition": string | null,"created_at": string,"deleted_at": string | null,"id": string,"model": string | null,"offers": NonNullable<Json>,"open_to_offers": boolean,"open_to_trade": boolean,"photo": string | null,"photos": NonNullable<Json>,"price": number,"qty": number,"rarity": string | null,"seller_id": string,"seller_location": string | null,"seller_mobile": string | null,"seller_name": string | null,"seller_photo": string | null,"seller_type": string | null,"source_item_id": string | null,"status": Database["public"]['Enums']["listing_status"],"updated_at": string,"variant": string | null
                  }
                  Insert: {
                    "brand": string,"condition"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"model"?: string | null,"offers"?: NonNullable<Json>,"open_to_offers"?: boolean,"open_to_trade"?: boolean,"photo"?: string | null,"photos"?: NonNullable<Json>,"price"?: number,"qty"?: number,"rarity"?: string | null,"seller_id": string,"seller_location"?: string | null,"seller_mobile"?: string | null,"seller_name"?: string | null,"seller_photo"?: string | null,"seller_type"?: string | null,"source_item_id"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"updated_at"?: string,"variant"?: string | null
                  }
                  Update: {
                    "brand"?: string,"condition"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"model"?: string | null,"offers"?: NonNullable<Json>,"open_to_offers"?: boolean,"open_to_trade"?: boolean,"photo"?: string | null,"photos"?: NonNullable<Json>,"price"?: number,"qty"?: number,"rarity"?: string | null,"seller_id"?: string,"seller_location"?: string | null,"seller_mobile"?: string | null,"seller_name"?: string | null,"seller_photo"?: string | null,"seller_type"?: string | null,"source_item_id"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"updated_at"?: string,"variant"?: string | null
                  }
                  Relationships: [
                    {
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
      foreignKeyName: "marketplace_listings_source_item_id_fkey"
      columns: ["source_item_id"]
isOneToOne: false
      referencedRelation: "collection_items"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "account_type": Database["public"]['Enums']["account_type"],"bio": string | null,"city": string | null,"country_code": string,"created_at": string,"deleted_at": string | null,"display_name": string,"handle": string,"handle_changed_at": string | null,"id": string,"level": number,"location": string | null,"mobile": string | null,"onboarding_completed_at": string | null,"photo_url": string | null,"plan": Database["public"]['Enums']["plan_tier"],"pro_until": string | null,"role": Database["public"]['Enums']["user_role"],"scan_quota_bonus": number,"scan_quota_reset_at": string,"scan_quota_used": number,"store_name": string | null,"tokens": number,"tutorial_dismissed_at": string | null,"updated_at": string,"xp": number
                  }
                  Insert: {
                    "account_type": Database["public"]['Enums']["account_type"],"bio"?: string | null,"city"?: string | null,"country_code"?: string,"created_at"?: string,"deleted_at"?: string | null,"display_name": string,"handle": string,"handle_changed_at"?: string | null,"id": string,"level"?: number,"location"?: string | null,"mobile"?: string | null,"onboarding_completed_at"?: string | null,"photo_url"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"pro_until"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"scan_quota_bonus"?: number,"scan_quota_reset_at"?: string,"scan_quota_used"?: number,"store_name"?: string | null,"tokens"?: number,"tutorial_dismissed_at"?: string | null,"updated_at"?: string,"xp"?: number
                  }
                  Update: {
                    "account_type"?: Database["public"]['Enums']["account_type"],"bio"?: string | null,"city"?: string | null,"country_code"?: string,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string,"handle"?: string,"handle_changed_at"?: string | null,"id"?: string,"level"?: number,"location"?: string | null,"mobile"?: string | null,"onboarding_completed_at"?: string | null,"photo_url"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"pro_until"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"scan_quota_bonus"?: number,"scan_quota_reset_at"?: string,"scan_quota_used"?: number,"store_name"?: string | null,"tokens"?: number,"tutorial_dismissed_at"?: string | null,"updated_at"?: string,"xp"?: number
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
                    "created_at": string,"deleted_at": string | null,"id": string,"notes": string | null,"reason": string | null,"reporter_id": string,"status": Database["public"]['Enums']["report_status"],"target_id": string | null,"target_name": string | null,"target_type": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"notes"?: string | null,"reason"?: string | null,"reporter_id": string,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string | null,"target_name"?: string | null,"target_type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"notes"?: string | null,"reason"?: string | null,"reporter_id"?: string,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string | null,"target_name"?: string | null,"target_type"?: string,"updated_at"?: string
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
    }
                  ]
                },"seller_reviews": {
                  Row: {
                    "buyer_id": string | null,"buyer_name": string | null,"comment": string | null,"created_at": string,"deleted_at": string | null,"id": string,"offer_id": string | null,"rating": number,"seller_id": string,"updated_at": string
                  }
                  Insert: {
                    "buyer_id"?: string | null,"buyer_name"?: string | null,"comment"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"offer_id"?: string | null,"rating": number,"seller_id": string,"updated_at"?: string
                  }
                  Update: {
                    "buyer_id"?: string | null,"buyer_name"?: string | null,"comment"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"offer_id"?: string | null,"rating"?: number,"seller_id"?: string,"updated_at"?: string
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
                    "brand": string | null,"created_at": string,"deleted_at": string | null,"id": string,"model": string | null,"notes": string | null,"owner_id": string,"updated_at": string
                  }
                  Insert: {
                    "brand"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"model"?: string | null,"notes"?: string | null,"owner_id": string,"updated_at"?: string
                  }
                  Update: {
                    "brand"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"model"?: string | null,"notes"?: string | null,"owner_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
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
            "public_profiles": {
                  Row: {
                    "account_type": Database["public"]['Enums']["account_type"] | null,"bio": string | null,"city": string | null,"country_code": string | null,"created_at": string | null,"display_name": string | null,"handle": string | null,"id": string | null,"is_pro": boolean | null,"level": number | null,"store_name": string | null,"xp": number | null
                  }
                  Insert: {
                           "account_type"?: Database["public"]['Enums']["account_type"] | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"handle"?: string | null,"id"?: string | null,"is_pro"?: never,"level"?: number | null,"store_name"?: string | null,"xp"?: number | null
                         }
                        Update: {
                           "account_type"?: Database["public"]['Enums']["account_type"] | null,"bio"?: string | null,"city"?: string | null,"country_code"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"handle"?: string | null,"id"?: string | null,"is_pro"?: never,"level"?: number | null,"store_name"?: string | null,"xp"?: number | null
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
            "dearmor":
{ Args: { "": string }; Returns: string
                           },
"emit_event":
{ Args: { "p_actor_id": string; "p_type": string; "p_entity": string; "p_entity_id"?: string | null; "p_payload"?: Json }; Returns: undefined
                           },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"redeem_invite":
{ Args: { "p_code": string }; Returns: undefined
                           }
          }
          Enums: {
            "account_type": "individual"|"shop","listing_status": "active"|"sold"|"removed","plan_tier": "free"|"pro","report_status": "open"|"reviewed"|"dismissed","user_role": "user"|"admin"
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
            "account_type": ["individual", "shop"],"listing_status": ["active", "sold", "removed"],"plan_tier": ["free", "pro"],"report_status": ["open", "reviewed", "dismissed"],"user_role": ["user", "admin"]
          }
        }
} as const

