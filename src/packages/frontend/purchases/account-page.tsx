import { Collapse } from "antd";
import { useState } from "react";
import Purchases from "./purchases";
import AccountStatus from "./account-status";
import Quotas from "./all-quotas-config";
import CostBarChart from "./cost-bar-chart";
import Subscriptions from "./subscriptions";
import UnpaidSubscriptions from "./unpaid-subscriptions";

type Key = string[] | string | number[] | number;

const cache: { activeKey: Key } = { activeKey: [] };

export default function PurchasesPage() {
  const [activeKey, setActiveKey] = useState<Key>(cache.activeKey);
  return (
    <div>
      <AccountStatus />
      <UnpaidSubscriptions
        style={{ margin: "15px 0", textAlign: "center" }}
        showWhen="unpaid"
      />
      <Collapse
        destroyInactivePanel /* so that data is refreshed when they are shown */
        activeKey={activeKey}
        onChange={(x) => {
          cache.activeKey = x;
          setActiveKey(x);
        }}
      >
        <Collapse.Panel key="transactions" header="Transactions">
          <Purchases />
        </Collapse.Panel>
        <Collapse.Panel key="limits" header="Limits">
          <Quotas />
        </Collapse.Panel>
        <Collapse.Panel key="spend" header="Spend">
          <CostBarChart />
        </Collapse.Panel>
        <Collapse.Panel
          key="subscriptions"
          header=<>
            Subscriptions
            <UnpaidSubscriptions style={{ float: "right" }} showWhen="paid" />
          </>
        >
          <UnpaidSubscriptions
            style={{ margin: "15px 0", textAlign: "center" }}
            showWhen="both"
          />
          <Subscriptions />
        </Collapse.Panel>
      </Collapse>
    </div>
  );
}