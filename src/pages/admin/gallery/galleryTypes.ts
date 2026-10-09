export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface Album {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  description: string;
  event_date: string | null;
  is_published: boolean;
  created_at: string;
}

export interface ImageRow {
  id: string;
  album_id: string;
  full_path: string;
  medium_path: string | null;
  thumb_path: string;
  width: number;
  height: number;
  caption: string;
  is_published: boolean;
  sort_order: number;
  source_name: string | null;
  created_at: string;
}

/** "Category / Album" labels for choosing where a photo goes. */
export function albumLabel(album: Album, categories: Category[]): string {
  return `${categories.find((c) => c.id === album.category_id)?.name ?? 'No category'} / ${album.title}`;
}
