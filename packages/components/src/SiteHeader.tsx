import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
  SelectContent,
  SelectField,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@exre/exui'
import { Menu, UserRound } from 'lucide-react'
import { useSyncExternalStore, type ReactNode, type Ref } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AuthArea, type AuthAreaProps } from '@components/src/AuthArea'
import { Logo } from '@components/src/Logo'
import styles from '@components/src/SiteHeader.module.scss'

/** 站点导航项，共用 Website 内部路由。 */
const NAV_ITEMS = [
  { to: '/docs/', label: 'Document' },
  { to: '/products', label: 'Products' },
  { to: '/aboutus', label: 'About Us' },
  { to: '/support', label: 'Support' },
] as const
const COMMUNITY_ITEMS = [
  { to: '/communities/rifling-911', label: 'Rifling 911' },
  { to: '/communities/caep', label: 'CAEP' },
] as const

/**
 * 站点顶栏：桌面端左侧字标、中间导航菜单、右侧登录区；手机端左侧导航
 * Select、中间字标、右侧账号 Select。
 *
 * 挂在 `apps/web/src/routes/RootLayout.tsx`，因此所有路由（含兜底页）共用。
 *
 * 三区布局用 `1fr auto 1fr` 网格：两侧等宽才能让中间的菜单**真正居中**，
 * 而不是随左右内容宽度漂移。尺寸与颜色全部走 ExUI 的 Token。
 */
export interface SiteHeaderProps {
  auth: AuthAreaProps
  mobileMenuButtonRef?: Ref<HTMLSpanElement>
  glassAtTop?: boolean
  /**
   * 顶栏右侧的通知入口（铃铛与未读 Popup）。
   *
   * 顶栏不认识通知业务：这里只是一个渲染槽位，节点由调用方提供，
   * 因此铃铛只存在一个实例，焦点归还也只指向那一个元素。
   */
  notifications?: ReactNode
}

function subscribeToScroll(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true })
  return () => window.removeEventListener('scroll', onChange)
}

const isScrolled = () => window.scrollY > 0
const serverIsScrolled = () => false

export function SiteHeader({
  auth,
  mobileMenuButtonRef,
  glassAtTop = false,
  notifications,
}: SiteHeaderProps) {
  const scrolled = useSyncExternalStore(subscribeToScroll, isScrolled, serverIsScrolled)
  const location = useLocation()
  const navigate = useNavigate()
  const aboutActive =
    location.pathname === '/about' ||
    location.pathname === '/aboutus' ||
    location.pathname.startsWith('/aboutus/')
  const visibleItems = NAV_ITEMS.filter(
    ({ to }) => to !== '/support' || auth.state.status === 'authenticated',
  )
  const supportActive =
    auth.state.status === 'authenticated' &&
    (location.pathname === '/support' || location.pathname.startsWith('/support/'))
  const selectedNavigation = supportActive
    ? '/support'
    : aboutActive
      ? '/aboutus'
      : [...visibleItems, ...COMMUNITY_ITEMS].some(({ to }) => to === location.pathname)
        ? location.pathname
        : ''

  return (
    <header
      className={`${styles.header}${scrolled || glassAtTop ? ' ex-glass' : ''}`}
      data-site-header
    >
      <div className={styles.inner}>
        <div className={styles.start}>
          <Logo />
        </div>

        {/* ExUI 的 `NavigationMenu` 自身就渲染 `<nav>`（Radix 默认标签为 "Main"），
            所以这里只能是一个普通容器：再套一层 `<nav>` 会产生嵌套的导航地标。 */}
        <div className={styles.nav}>
          <NavigationMenu viewport={false} aria-label="主导航">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Communities</NavigationMenuTrigger>
                <NavigationMenuContent className={styles.dropdownMenu}>
                  {COMMUNITY_ITEMS.map(({ to, label }) => (
                    <NavigationMenuLink asChild key={to}>
                      <Link to={to}>{label}</Link>
                    </NavigationMenuLink>
                  ))}
                </NavigationMenuContent>
              </NavigationMenuItem>
              {visibleItems.map(({ to, label }) => (
                <NavigationMenuItem key={to}>
                  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                    <Link
                      to={to}
                      aria-current={
                        (to === '/aboutus' && aboutActive) || (to === '/support' && supportActive)
                          ? 'page'
                          : undefined
                      }
                    >
                      {label}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className={styles.end}>
          {notifications !== undefined && (
            <span className={styles.notificationsSlot}>{notifications}</span>
          )}
          {/* `display: contents`：桌面上 account 区直接参与 `.end` 的 flex 布局，
              窄屏时整块隐藏，由 `.mobileAccount` 的 Select 接管。 */}
          <span className={styles.desktopAuth}>
            <AuthArea {...auth} />
          </span>
        </div>

        <div className={styles.mobileNav}>
          <SelectField
            value={selectedNavigation}
            onValueChange={(value) => {
              if ([...visibleItems, ...COMMUNITY_ITEMS].some(({ to }) => to === value))
                navigate(value)
            }}
          >
            <SelectTrigger className={styles.mobileNavTrigger} aria-label="打开导航菜单">
              <Menu aria-hidden="true" />
              <SelectValue placeholder="导航菜单" />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                <SelectLabel>Communities</SelectLabel>
                {COMMUNITY_ITEMS.map(({ to, label }) => (
                  <SelectItem key={to} value={to}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>导航</SelectLabel>
                {visibleItems.map(({ to, label }) => (
                  <SelectItem key={to} value={to}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </SelectField>
        </div>

        <div className={styles.mobileAccount}>
          <MobileAccountSelect auth={auth} triggerRef={mobileMenuButtonRef} />
        </div>
      </div>
    </header>
  )
}

function MobileAccountSelect({
  auth,
  triggerRef,
}: {
  auth: AuthAreaProps
  triggerRef?: Ref<HTMLSpanElement>
}) {
  if (auth.state.status === 'loading') {
    return <Spinner aria-label="正在恢复登录状态" />
  }

  const selectAccountItem = (value: string) => {
    if (value === 'login') auth.onLogin()
    else if (value === 'register') auth.onRegister()
    else if (value === 'retry') auth.onRetry()
    else if (value === 'profile') auth.onProfile()
    else if (value === 'settings') auth.onSettings()
    else if (value === 'logout') auth.onLogout()
  }

  return (
    <SelectField value="" onValueChange={selectAccountItem}>
      <span ref={triggerRef}>
        <SelectTrigger
          className={`${styles.mobileAccountTrigger} ${
            auth.state.status === 'authenticated' ? styles.mobileAvatarTrigger : ''
          }`}
          aria-label="用户菜单"
        >
          {auth.state.status === 'authenticated' ? (
            <Avatar size="sm" className={styles.mobileAvatar}>
              {auth.state.avatarUrl && <AvatarImage src={auth.state.avatarUrl} alt="" />}
              <AvatarFallback>{auth.state.initial}</AvatarFallback>
            </Avatar>
          ) : (
            <UserRound aria-hidden="true" />
          )}
          <SelectValue placeholder="用户菜单" />
        </SelectTrigger>
      </span>
      <SelectContent position="popper" align="end">
        <SelectGroup>
          <SelectLabel>
            {auth.state.status === 'authenticated' ? auth.state.nickname : '账号'}
          </SelectLabel>
          {auth.state.status === 'anonymous' && (
            <>
              <SelectItem value="login">登录</SelectItem>
              <SelectItem value="register">注册</SelectItem>
            </>
          )}
          {auth.state.status === 'authenticated' && (
            <>
              <SelectItem value="profile">个人资料</SelectItem>
              <SelectItem value="settings">设置</SelectItem>
              <SelectItem value="logout">退出登录</SelectItem>
            </>
          )}
          {auth.state.status === 'unavailable' && (
            <SelectItem value="retry">重试登录状态</SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </SelectField>
  )
}
