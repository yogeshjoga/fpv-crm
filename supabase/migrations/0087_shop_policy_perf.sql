-- The shop dashboard timed out ("canceling statement due to statement timeout"). The shop has about 4,200 products and
-- 7,000 options, and every row-level policy called has_module_access() once PER ROW, so counting low stock took
-- over five seconds. Wrapping the call in (select ...) makes Postgres work it out once per query instead.
-- The rules themselves are unchanged: the same roles are allowed to do the same things.

alter policy shop_announcements_read_staff on public.shop_announcements using ((select public.has_module_access('shop', 'read')));
alter policy shop_announcements_write on public.shop_announcements using ((select public.has_module_access('shop', 'write'))) with check ((select public.has_module_access('shop', 'write')));
alter policy shop_brands_write on public.shop_brands using ((select public.has_module_access('shop', 'write'))) with check ((select public.has_module_access('shop', 'write')));
alter policy shop_order_items_read on public.shop_order_items using ((select public.has_module_access('shop', 'read')));
alter policy shop_orders_delete on public.shop_orders using ((select public.is_super_admin()));
alter policy shop_orders_read on public.shop_orders using ((select public.has_module_access('shop', 'read')));
alter policy shop_orders_update on public.shop_orders using ((select public.has_module_access('shop', 'write'))) with check ((select public.has_module_access('shop', 'write')));
alter policy shop_variants_read_staff on public.shop_product_variants using ((select public.has_module_access('shop', 'read')));
alter policy shop_variants_write on public.shop_product_variants using ((select public.has_module_access('shop', 'write'))) with check ((select public.has_module_access('shop', 'write')));
alter policy shop_products_read_staff on public.shop_products using ((select public.has_module_access('shop', 'read')));
alter policy shop_products_write on public.shop_products using ((select public.has_module_access('shop', 'write'))) with check ((select public.has_module_access('shop', 'write')));
