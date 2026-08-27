import { Anchor, Card, Collapse, Typography } from "antd";
import { BookOutlined } from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuthStore } from "../../store/useAuthStore";
import { useIsMobile } from "../../hooks/useIsMobile";

type GuideSection = {
  id: string;
  adminOnly?: boolean;
  titleKey: string;
  paragraphKeys: string[];
  stepKeys?: string[];
};

const USER_SECTIONS: GuideSection[] = [
  {
    id: "intro",
    titleKey: "userGuide.sections.intro.title",
    paragraphKeys: [
      "userGuide.sections.intro.p1",
      "userGuide.sections.intro.p2",
      "userGuide.sections.intro.p3",
    ],
  },
  {
    id: "gettingStarted",
    titleKey: "userGuide.sections.gettingStarted.title",
    paragraphKeys: ["userGuide.sections.gettingStarted.p1"],
    stepKeys: [
      "userGuide.sections.gettingStarted.s1",
      "userGuide.sections.gettingStarted.s2",
      "userGuide.sections.gettingStarted.s3",
      "userGuide.sections.gettingStarted.s4",
    ],
  },
  {
    id: "licenseBasics",
    titleKey: "userGuide.sections.licenseBasics.title",
    paragraphKeys: [
      "userGuide.sections.licenseBasics.p1",
      "userGuide.sections.licenseBasics.p2",
      "userGuide.sections.licenseBasics.p3",
    ],
  },
  {
    id: "activate",
    titleKey: "userGuide.sections.activate.title",
    paragraphKeys: ["userGuide.sections.activate.p1"],
    stepKeys: [
      "userGuide.sections.activate.s1",
      "userGuide.sections.activate.s2",
      "userGuide.sections.activate.s3",
      "userGuide.sections.activate.s4",
    ],
  },
  {
    id: "purchase",
    titleKey: "userGuide.sections.purchase.title",
    paragraphKeys: ["userGuide.sections.purchase.p1"],
    stepKeys: [
      "userGuide.sections.purchase.s1",
      "userGuide.sections.purchase.s2",
      "userGuide.sections.purchase.s3",
      "userGuide.sections.purchase.s4",
      "userGuide.sections.purchase.s5",
    ],
  },
  {
    id: "licenseRequest",
    titleKey: "userGuide.sections.licenseRequest.title",
    paragraphKeys: [
      "userGuide.sections.licenseRequest.p1",
      "userGuide.sections.licenseRequest.p2",
    ],
    stepKeys: [
      "userGuide.sections.licenseRequest.s1",
      "userGuide.sections.licenseRequest.s2",
      "userGuide.sections.licenseRequest.s3",
    ],
  },
  {
    id: "extension",
    titleKey: "userGuide.sections.extension.title",
    paragraphKeys: [
      "userGuide.sections.extension.p1",
      "userGuide.sections.extension.p2",
    ],
    stepKeys: [
      "userGuide.sections.extension.s1",
      "userGuide.sections.extension.s2",
      "userGuide.sections.extension.s3",
      "userGuide.sections.extension.s4",
    ],
  },
  {
    id: "account",
    titleKey: "userGuide.sections.account.title",
    paragraphKeys: ["userGuide.sections.account.p1"],
    stepKeys: [
      "userGuide.sections.account.s1",
      "userGuide.sections.account.s2",
      "userGuide.sections.account.s3",
    ],
  },
  {
    id: "faq",
    titleKey: "userGuide.sections.faq.title",
    paragraphKeys: [
      "userGuide.sections.faq.p1",
      "userGuide.sections.faq.p2",
      "userGuide.sections.faq.p3",
      "userGuide.sections.faq.p4",
    ],
  },
  {
    id: "admin",
    adminOnly: true,
    titleKey: "userGuide.sections.admin.title",
    paragraphKeys: ["userGuide.sections.admin.p1"],
    stepKeys: [
      "userGuide.sections.admin.s1",
      "userGuide.sections.admin.s2",
      "userGuide.sections.admin.s3",
      "userGuide.sections.admin.s4",
      "userGuide.sections.admin.s5",
      "userGuide.sections.admin.s6",
    ],
  },
];

function SectionBody({
  paragraphKeys,
  stepKeys,
}: Pick<GuideSection, "paragraphKeys" | "stepKeys">) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 text-slate-700">
      {paragraphKeys.map((key) => (
        <Typography.Paragraph key={key} className="!mb-0">
          {t(key)}
        </Typography.Paragraph>
      ))}
      {stepKeys && stepKeys.length > 0 ? (
        <ol className="list-decimal space-y-2 pl-5">
          {stepKeys.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function UserGuidePage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const role = useAuthStore((s) => s.user?.role);
  const privacyUrl = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/privacy`;

  const sections = useMemo(
    () => USER_SECTIONS.filter((s) => !s.adminOnly || role === "admin"),
    [role],
  );

  const anchorItems = sections.map((s) => ({
    key: s.id,
    href: `#guide-${s.id}`,
    title: t(s.titleKey),
  }));

  return (
    <PageContainer
      title={
        <span className="inline-flex items-center gap-2">
          <BookOutlined />
          {t("userGuide.title")}
        </span>
      }
      subTitle={t("userGuide.subtitle")}
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link to="/my-license" className="text-blue-600 hover:underline">
          {t("menu.myLicense")} →
        </Link>
        <Link to="/dashboard" className="text-blue-600 hover:underline">
          {t("menu.overview")} →
        </Link>
        {privacyUrl.startsWith("http") ? (
          <a
            href={privacyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {t("userGuide.privacyLink")} ↗
          </a>
        ) : null}
      </div>

      {isMobile ? (
        <Collapse
          accordion
          defaultActiveKey={[sections[0]?.id]}
          items={sections.map((s) => ({
            key: s.id,
            label: <span className="font-medium">{t(s.titleKey)}</span>,
            children: (
              <SectionBody
                paragraphKeys={s.paragraphKeys}
                stepKeys={s.stepKeys}
              />
            ),
          }))}
        />
      ) : (
        <div className="flex w-full gap-8">
          <div className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-52 shrink-0 self-start overflow-y-auto lg:block">
            <Anchor
              items={anchorItems}
              offsetTop={88}
              affix={false}
              targetOffset={88}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            {sections.map((s) => (
              <Card
                key={s.id}
                id={`guide-${s.id}`}
                title={t(s.titleKey)}
                className="scroll-mt-24 shadow-sm mb-4!"
              >
                <SectionBody
                  paragraphKeys={s.paragraphKeys}
                  stepKeys={s.stepKeys}
                />
              </Card>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
