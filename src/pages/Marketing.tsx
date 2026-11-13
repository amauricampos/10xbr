import { ArrowRight, EyeOff, Fingerprint, Lock, Plane, ScrollText, Sparkles, Target, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSession } from '../session';
import { Disclaimer, Nav } from '../ui';

/**
 * Marketing landing page for U.S. owners who arrive cold. Kept for when the
 * platform is offered publicly; the home page is the briefed-owner overview.
 * Reachable at /sell and not linked from anywhere.
 */
export function MarketingLanding() {
  const { t } = useSession();
  const why = [
    {
      icon: Target,
      title: t('Buyers who need to close', 'Compradores que precisam fechar'),
      text: t(
        'Their move to the U.S. depends on owning an operating business. They are not browsing. They are buying.',
        'A mudança deles para os EUA depende de ter um negócio em operação. Eles não estão só olhando. Estão comprando.',
      ),
    },
    {
      icon: Wallet,
      title: t('Funds checked before you meet', 'Recursos verificados antes do contato'),
      text: t(
        'We review each buyer’s company, track record and capital before any introduction, so your time goes to real offers.',
        'Analisamos a empresa, o histórico e o capital de cada comprador antes de qualquer apresentação, para que o seu tempo vá para propostas reais.',
      ),
    },
    {
      icon: Users,
      title: t('What you built carries on', 'O que você construiu continua'),
      text: t(
        'These buyers need the business to keep running with its team. They are buying it to operate it, not to strip it.',
        'Esses compradores precisam que o negócio continue funcionando com a equipe. Compram para operar, não para desmontar.',
      ),
    },
    {
      icon: EyeOff,
      title: t('Private from start to finish', 'Sigilo do começo ao fim'),
      text: t(
        'Your business is never listed publicly. Details go only to screened buyers, under a signed NDA.',
        'O seu negócio nunca é anunciado publicamente. Os detalhes vão apenas para compradores selecionados, sob NDA assinado.',
      ),
    },
  ];
  const steps = [
    {
      time: t('2 min', '2 min'),
      title: t('See if you qualify', 'Veja se você se qualifica'),
      text: t('Eight one-tap questions. You get the answer right away.', 'Oito perguntas de um toque. A resposta sai na hora.'),
    },
    {
      time: t('5 min', '5 min'),
      title: t('Share a few numbers', 'Informe alguns números'),
      text: t('Revenue, earnings, team and asking price. Round numbers are fine.', 'Faturamento, lucro, equipe e preço pedido. Números redondos bastam.'),
    },
    {
      time: t('1–3 days', '1–3 dias'),
      title: t('Back it up', 'Comprove'),
      text: t('Sign the NDA and upload five documents you already have.', 'Assine o NDA e envie cinco documentos que você já tem.'),
    },
    {
      time: t('1–2 weeks', '1–2 semanas'),
      title: t('Meet your buyers', 'Conheça seus compradores'),
      text: t('Once verified, your business is presented to screened international buyers.', 'Depois de verificado, o seu negócio é apresentado a compradores internacionais selecionados.'),
    },
  ];
  const safety = [
    {
      icon: Lock,
      title: t('Encrypted before storage', 'Criptografado antes de armazenar'),
      text: t('Every file is sealed with AES-256 before it is saved. Downloads require your sign-in.', 'Cada arquivo é selado com AES-256 antes de ser salvo. Downloads exigem o seu login.'),
    },
    {
      icon: ScrollText,
      title: t('NDA before documents', 'NDA antes dos documentos'),
      text: t('You sign a mutual confidentiality agreement in the platform before sharing anything.', 'Você assina um acordo mútuo de confidencialidade na plataforma antes de compartilhar qualquer coisa.'),
    },
    {
      icon: Fingerprint,
      title: t('Every access is logged', 'Todo acesso é registrado'),
      text: t('A permanent record shows who opened, uploaded or changed anything.', 'Um registro permanente mostra quem abriu, enviou ou alterou qualquer item.'),
    },
    {
      icon: Sparkles,
      title: t('AI reads first, people decide', 'A IA lê primeiro, pessoas decidem'),
      text: t('AI takes the first pass on every answer and document. Our team reviews each step.', 'A IA faz a primeira leitura de cada resposta e documento. Nossa equipe revisa cada etapa.'),
    },
  ];
  return (
    <>
      <Nav />
      <main>
        <section className="hero wrap">
          <p className="eyebrow">{t('For U.S. business owners', 'Para donos de negócios nos EUA')}</p>
          <h1 style={{ marginTop: 16 }}>
            {t('You built it.', 'Você construiu.')}
            <br />
            <span className="gradient-text">{t('Now cash in.', 'Agora é hora de colher.')}</span>
          </h1>
          <p className="lead">
            {t(
              'Years of early mornings and missed weekends are worth something. Retire, enjoy it, or start your next venture. We bring you qualified international buyers who are ready to invest in a business like yours.',
              'Anos de madrugadas e fins de semana perdidos valem alguma coisa. Aposente-se, aproveite ou comece o próximo projeto. Trazemos compradores internacionais qualificados, prontos para investir em um negócio como o seu.',
            )}
          </p>
          <Link to="/check/us" className="btn primary lg">
            {t('See if my business qualifies', 'Ver se o meu negócio se qualifica')} <ArrowRight size={18} />
          </Link>
          <p className="tiny faint" style={{ marginTop: 14 }}>
            {t('Two minutes. Eight questions. Confidential.', 'Dois minutos. Oito perguntas. Confidencial.')}
          </p>
        </section>

        <section className="wrap">
          <div className="center stack" style={{ '--gap': '10px', marginBottom: 28 } as React.CSSProperties}>
            <p className="eyebrow">{t('Why international buyers', 'Por que compradores internacionais')}</p>
            <h2>{t('A bigger pool of buyers than your local market.', 'Mais compradores do que o seu mercado local oferece.')}</h2>
            <p className="muted" style={{ maxWidth: 640, margin: '0 auto' }}>
              {t(
                'Established entrepreneurs abroad use the L-1 visa and other investor routes to move to the United States by acquiring a going business. We find them, screen them and bring them to you.',
                'Empresários estabelecidos no exterior usam o visto L-1 e outras rotas de investidor para se mudar para os Estados Unidos comprando um negócio em funcionamento. Nós os encontramos, avaliamos e trazemos até você.',
              )}
            </p>
          </div>
          <div className="grid two">
            {why.map((s) => (
              <div key={s.title} className="glass feature">
                <s.icon size={22} style={{ flex: 'none', color: 'var(--mint)', marginTop: 2 }} />
                <div>
                  <h3>{s.title}</h3>
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {s.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section wrap">
          <div className="center stack" style={{ '--gap': '10px', marginBottom: 28 } as React.CSSProperties}>
            <p className="eyebrow">{t('How it works', 'Como funciona')}</p>
            <h2>{t('Four short steps. No paperwork until you qualify.', 'Quatro passos curtos. Nenhum documento antes de se qualificar.')}</h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            {steps.map((s, i) => (
              <div key={s.title} className="glass stage-card">
                <div className="row between">
                  <span className="stage-num">{i + 1}</span>
                  <span className="tiny faint">{s.time}</span>
                </div>
                <h3 style={{ marginTop: 6 }}>{s.title}</h3>
                <p className="small muted">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="center" style={{ marginTop: 28 }}>
            <Link to="/check/us" className="btn primary lg">
              {t('Start the two-minute check', 'Começar a checagem de dois minutos')} <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="wrap">
          <Link to="/check/br" className="glass buyer-card">
            <Plane size={26} style={{ color: 'var(--mint)', flex: 'none' }} />
            <div className="grow">
              <h3>{t('Own a company in Brazil?', 'Tem uma empresa no Brasil?')}</h3>
              <p className="small muted" style={{ marginTop: 4 }}>
                {t(
                  'Buy an established U.S. business and build your path to an L-1 visa. Find out in two minutes if your company qualifies.',
                  'Compre um negócio estabelecido nos EUA e construa o seu caminho para o visto L-1. Descubra em dois minutos se a sua empresa se qualifica.',
                )}
              </p>
            </div>
            <span className="btn">
              {t('Check my company', 'Avaliar minha empresa')} <ArrowRight size={17} />
            </span>
          </Link>
        </section>

        <section className="section wrap">
          <div className="center stack" style={{ '--gap': '10px', marginBottom: 28 } as React.CSSProperties}>
            <p className="eyebrow">{t('Security', 'Segurança')}</p>
            <h2>{t('Built for documents you would not email.', 'Feito para documentos que você não mandaria por e-mail.')}</h2>
          </div>
          <div className="grid two">
            {safety.map((s) => (
              <div key={s.title} className="glass feature">
                <s.icon size={22} style={{ flex: 'none', color: 'var(--mint)', marginTop: 2 }} />
                <div>
                  <h3>{s.title}</h3>
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {s.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="foot">
        <div className="wrap stack">
          <Disclaimer />
          <div className="row between wrapping">
            <span>© {new Date().getFullYear()} 10xBR</span>
            <Link to="/brand">{t('Brand', 'Marca')}</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
