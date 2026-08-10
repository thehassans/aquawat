import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { createPortal } from 'react-dom';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import {
  CodeIcon,
  GlobeIcon,
  LayersIcon,
  UserPlusIcon,
  Users,
  Star,
  FileText,
  Shield,
  RotateCcw,
  Handshake,
  Leaf,
  HelpCircle,
  BarChart,
  PlugIcon,
} from 'lucide-react';

export function Header3({ isArabic, setIsArabic }) {
  const [open, setOpen] = React.useState(false);
  const scrolled = useScroll(10);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={cn('sticky top-0 z-50 w-full border-b border-transparent', {
        'bg-background/95 supports-[backdrop-filter]:bg-background/50 border-border backdrop-blur-lg':
          scrolled,
      })}
    >
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <a href="#" className="hover:bg-accent rounded-md p-2">
            <WordmarkIcon className="h-4" />
          </a>
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList className="gap-2">
              {[
                { href: '#', label: isArabic ? 'الرئيسية' : 'Home' },
                { href: '#features', label: isArabic ? 'المميزات' : 'Features' },
                { href: '#modules', label: isArabic ? 'الوحدات' : 'Modules' },
                { href: '#pricing', label: isArabic ? 'الأسعار' : 'Pricing' },
                { href: '#contact', label: isArabic ? 'اتصل بنا' : 'Contact' },
              ].map((link) => (
                <NavigationMenuItem key={link.label}>
                  <NavigationMenuLink href={link.href} className="px-4 py-2 hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors">
                    {link.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={() => setIsArabic?.(!isArabic)}
            className="flex items-center gap-2 px-3 py-2 rounded-full border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <GlobeIcon className="w-4 h-4" />
            {isArabic ? 'English' : 'عربي'}
          </button>
          <Button variant="ghost" size="icon" asChild className="hidden lg:flex" title={isArabic ? 'تطبيق ويندوز' : 'Windows App'}>
            <a href="https://maqder.com/downloads/MaqderDesktop-Setup.exe">
              <svg className="w-5 h-5 text-gray-600 hover:text-primary-600 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801"/>
              </svg>
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/login">{isArabic ? 'تسجيل الدخول' : 'Sign In'}</a>
          </Button>
          <Button asChild>
            <a href="/login">{isArabic ? 'ابدأ الآن' : 'Get Started'}</a>
          </Button>
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setOpen(!open)}
          className="md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label="Toggle menu"
        >
          <MenuToggleIcon open={open} className="size-5" duration={300} />
        </Button>
      </nav>
      <MobileMenu open={open} className="flex flex-col justify-between gap-2 overflow-y-auto">
        <div className="flex flex-col gap-4 mt-8">
          {[
            { href: '#', label: isArabic ? 'الرئيسية' : 'Home' },
            { href: '#features', label: isArabic ? 'المميزات' : 'Features' },
            { href: '#modules', label: isArabic ? 'الوحدات' : 'Modules' },
            { href: '#pricing', label: isArabic ? 'الأسعار' : 'Pricing' },
            { href: '#contact', label: isArabic ? 'اتصل بنا' : 'Contact' },
          ].map((link) => (
            <a key={link.label} href={link.href} className="text-lg font-medium p-2 hover:bg-accent rounded-md" onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <div className="h-px bg-border my-2" />
          <button
            onClick={() => { setIsArabic?.(!isArabic); setOpen(false); }}
            className="flex justify-center items-center gap-2 px-4 py-3 rounded-md border border-gray-200 font-medium hover:bg-gray-50 transition-colors"
          >
            <GlobeIcon className="w-5 h-5" />
            {isArabic ? 'Switch to English' : 'التبديل للعربية'}
          </button>
        </div>
        <div className="flex flex-col gap-2 mt-auto pb-4">
          <Button variant="outline" className="w-full bg-transparent" asChild>
            <a href="/login">{isArabic ? 'تسجيل الدخول' : 'Sign In'}</a>
          </Button>
          <Button className="w-full" asChild>
            <a href="/login">{isArabic ? 'ابدأ الآن' : 'Get Started'}</a>
          </Button>
        </div>
      </MobileMenu>
    </header>
  );
}

function MobileMenu({ open, children, className, ...props }) {
  if (!open || typeof window === 'undefined') return null;

  return createPortal(
    <div
      id="mobile-menu"
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/50 backdrop-blur-lg',
        'fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-y md:hidden',
      )}
    >
      <div
        data-slot={open ? 'open' : 'closed'}
        className={cn(
          'data-[slot=open]:animate-in data-[slot=open]:zoom-in-97 ease-out',
          'size-full p-4',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ListItem({
  title,
  description,
  icon: Icon,
  className,
  href,
  ...props
}) {
  return (
    <NavigationMenuLink className={cn('w-full flex flex-row gap-x-2 data-[active=true]:focus:bg-accent data-[active=true]:hover:bg-accent data-[active=true]:bg-accent/50 data-[active=true]:text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground rounded-sm p-2', className)} {...props} asChild>
      <a href={href}>
        <div className="bg-background/40 flex aspect-square size-12 items-center justify-center rounded-md border shadow-sm">
          <Icon className="text-foreground size-5" />
        </div>
        <div className="flex flex-col items-start justify-center">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground text-xs">{description}</span>
        </div>
      </a>
    </NavigationMenuLink>
  );
}

const productLinks = [
  {
    title: 'Website Builder',
    href: '#',
    description: 'Create responsive websites with ease',
    icon: GlobeIcon,
  },
  {
    title: 'Cloud Platform',
    href: '#',
    description: 'Deploy and scale apps in the cloud',
    icon: LayersIcon,
  },
  {
    title: 'Team Collaboration',
    href: '#',
    description: 'Tools to help your teams work better together',
    icon: UserPlusIcon,
  },
  {
    title: 'Analytics',
    href: '#',
    description: 'Track and analyze your website traffic',
    icon: BarChart,
  },
  {
    title: 'Integrations',
    href: '#',
    description: 'Connect your apps and services',
    icon: PlugIcon,
  },
  {
    title: 'API',
    href: '#',
    description: 'Build custom integrations with our API',
    icon: CodeIcon,
  },
];

const companyLinks = [
  {
    title: 'About Us',
    href: '#',
    description: 'Learn more about our story and team',
    icon: Users,
  },
  {
    title: 'Customer Stories',
    href: '#',
    description: 'See how we’ve helped our clients succeed',
    icon: Star,
  },
  {
    title: 'Partnerships',
    href: '#',
    icon: Handshake,
    description: 'Collaborate with us for mutual growth',
  },
];

const companyLinks2 = [
  {
    title: 'Terms of Service',
    href: '#',
    icon: FileText,
  },
  {
    title: 'Privacy Policy',
    href: '#',
    icon: Shield,
  },
  {
    title: 'Refund Policy',
    href: '#',
    icon: RotateCcw,
  },
  {
    title: 'Blog',
    href: '#',
    icon: Leaf,
  },
  {
    title: 'Help Center',
    href: '#',
    icon: HelpCircle,
  },
];

function useScroll(threshold) {
  const [scrolled, setScrolled] = React.useState(false);

  const onScroll = React.useCallback(() => {
    setScrolled(window.scrollY > threshold);
  }, [threshold]);

  React.useEffect(() => {
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  React.useEffect(() => {
    onScroll();
  }, [onScroll]);

  return scrolled;
}

const WordmarkIcon = (props) => (
  <img src="/maqderlogolandingpage.webp" alt="Maqder" className="h-24 w-auto object-contain" />
);
