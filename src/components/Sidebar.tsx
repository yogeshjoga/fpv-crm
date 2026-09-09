import { Workspace, MAIN_NAV_ITEMS } from '../config/navigation';

export function Sidebar({ activeWorkspace, activePage, setActivePage }: { activeWorkspace: Workspace, activePage: string, setActivePage: (p: string) => void }) {
  const items = MAIN_NAV_ITEMS;

  return (
    <aside className="fixed left-6 top-1/2 -translate-y-1/2 bg-[#1a1a1a] rounded-[2rem] py-6 px-3 flex flex-col items-center gap-5 shadow-2xl z-50 hidden md:flex">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = 
          activePage === item.title || 
          (item.title === 'Business Partner' && activePage === 'Business Partners') ||
          (item.title === 'Administration' && activePage === 'Administrator') ||
          (item.title === 'Enquiry' && activePage === 'Enquiries');

        return (
          <button 
            key={item.title} 
            onClick={() => setActivePage(item.title)}
            title={item.title}
            className={`p-2.5 rounded-full transition-all relative group ${
              isActive 
                ? 'text-white bg-white/15 shadow-inner scale-105' 
                : 'text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            
            {/* Tooltip on hover */}
            <span className="absolute left-full ml-3 px-2.5 py-1 bg-neutral-900 text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {item.title}
            </span>
          </button>
        );
      })}
    </aside>
  );
}

