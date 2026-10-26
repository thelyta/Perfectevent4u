// Service icons shared by the website and the admin panel.
window.PE_ICONS = {
  planning: '<path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"/><path d="M12 12L20 7.5"/><path d="M12 12V21"/><path d="M12 12L4 7.5"/>',
  floral: '<path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5M12 7.5A4.5 4.5 0 1 0 7.5 12M12 7.5V9m-4.5 3a4.5 4.5 0 1 1 4.5 4.5M7.5 12H9m3 4.5a4.5 4.5 0 1 1-4.5-4.5M12 16.5V15m4.5-3a4.5 4.5 0 1 1-4.5 4.5M16.5 12H15"/>',
  management: '<path d="M2 22h20"/><path d="M6 22V12l6-8 6 8v10"/><path d="M12 22v-6"/><path d="M12 8v4"/><path d="M8 22v-4a2 2 0 0 1 4 0v4"/><path d="M16 22v-4a2 2 0 0 0-4 0v4"/>',
  venue: '<path d="M3 21h18"/><path d="M5 21V10l7-6 7 6v11"/><path d="M9 21v-6h6v6"/>',
  decor: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 17l.7 1.8L21.5 19.5l-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7L19 17z"/>',
  catering: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8 7c0-1.5 1-1.5 1-3"/><path d="M12 7c0-1.5 1-1.5 1-3"/><path d="M16 7c0-1.5 1-1.5 1-3"/>',
  photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'
};

window.PE_ICON_LABELS = {
  planning: 'Planning',
  floral: 'Floral',
  management: 'Day management',
  venue: 'Venue',
  decor: 'Styling & decor',
  catering: 'Catering',
  photo: 'Photography',
  music: 'Music & entertainment'
};

window.peIcon = function (name) {
  var inner = window.PE_ICONS[name] || window.PE_ICONS.planning;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
};
