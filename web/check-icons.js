const lucide = require('lucide-react');
const icons = ['LayoutDashboard', 'Users', 'GraduationCap', 'UserSquare2', 'CheckSquare', 'BookOpen', 'FileText', 'CalendarDays', 'Bell', 'BookMarked', 'Banknote', 'Award', 'CalendarOff', 'Files', 'BarChart3', 'MessageSquare', 'Bus', 'UserPlus', 'Fingerprint', 'Wallet', 'Package', 'Loader2'];

icons.forEach(icon => {
  if (!lucide[icon]) {
    console.log('Missing icon: ' + icon);
  }
});
console.log('Done checking icons.');
