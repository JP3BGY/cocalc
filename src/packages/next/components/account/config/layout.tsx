/*
 *  This file is part of CoCalc: Copyright © 2021 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import { Alert, Divider, Layout, Space } from "antd";
import { join } from "path";

import { Icon } from "@cocalc/frontend/components/icon";
import { capitalize } from "@cocalc/util/misc";
import Avatar from "components/account/avatar";
import Config from "components/account/config";
import InPlaceSignInOrUp from "components/auth/in-place-sign-in-or-up";
import A from "components/misc/A";
import Loading from "components/share/loading";
import basePath from "lib/base-path";
import useIsBrowser from "lib/hooks/is-browser";
import useProfile from "lib/hooks/profile";
import { useRouter } from "next/router";
import Anonymous from "./anonymous";
import ConfigMenu from "./menu";
import { menu } from "./register";
import Search from "./search/component";
import { Paragraph, Text, Title } from "components/misc";
import { COLORS } from "@cocalc/util/theme";
import SiteName from "components/share/site-name";

const { Content, Sider } = Layout;

interface Props {
  page: string[]; // e.g. ["account", "name"]
}

export default function ConfigLayout({ page }: Props) {
  const router = useRouter();
  const isBrowser = useIsBrowser();
  const profile = useProfile({ noCache: true });
  if (!profile) {
    return <Loading />;
  }
  const { account_id, is_anonymous } = profile;

  if (!account_id) {
    return (
      <Alert
        style={{ margin: "15px auto" }}
        type="warning"
        message={
          <InPlaceSignInOrUp
            title="Account Configuration"
            why="to edit your account configuration"
            onSuccess={() => {
              router.reload();
            }}
          />
        }
      />
    );
  }

  if (is_anonymous) {
    return <Anonymous />;
  }

  const [main, sub] = page;
  const info = menu[main]?.[sub];
  const content = (
    <Content
      style={{
        padding: 24,
        margin: 0,
        minHeight: 500,
        ...(info?.danger
          ? { color: "#ff4d4f", backgroundColor: COLORS.ATND_BG_RED_L }
          : undefined),
      }}
    >
      <Space style={{ marginBottom: "15px" }}>
        <Avatar account_id={account_id} style={{ marginRight: "15px" }} />
        <div style={{ color: COLORS.GRAY }}>
          <Text strong style={{ fontSize: "13pt" }}>
            {profile?.first_name} {profile?.last_name}
            {profile.name ? ` (@${profile.name})` : ""}
          </Text>
          <div>Your account</div>
        </div>
      </Space>
      {main != "search" && <Search />}
      {info && (
        <>
          <Title level={2}>
            <Icon name={info.icon} style={{ marginRight: "5px" }} />{" "}
            {capitalize(main)} - {info.title}
          </Title>
          <Paragraph type="secondary">{info.desc}</Paragraph>
          <Divider />
        </>
      )}
      {info?.desc?.toLowerCase().includes("todo") && (
        <Alert
          style={{ margin: "15px auto", maxWidth: "600px" }}
          message={<b>Under Constructions</b>}
          description={
            <Paragraph>
              This page is under construction. To configure your <SiteName />{" "}
              account, visit{" "}
              <A href={join(basePath, "settings")} external>
                Account Preferences
              </A>
              .
            </Paragraph>
          }
          type="warning"
          showIcon
        />
      )}
      <Config main={main} sub={sub} />
    </Content>
  );
  return (
    <Layout>
      <Sider width={"30ex"} breakpoint="sm" collapsedWidth="0">
        {isBrowser && <ConfigMenu main={main} sub={sub} />}
      </Sider>
      <Layout
        style={{
          padding: "0",
          backgroundColor: "white",
          color: COLORS.GRAY_D,
        }}
      >
        {content}
      </Layout>
    </Layout>
  );
}
