import type {
  Configuration,
  Images,
} from "@cocalc/util/db-schema/compute-servers";
import { Radio } from "antd";
import { useEffect, useMemo, useState } from "react";
import { A } from "@cocalc/frontend/components";

interface Props {
  setConfig;
  configuration: Configuration;
  disabled?: boolean;
  image: string;
  IMAGES: Images;
  style?;
}

export default function SelectVersion({
  setConfig,
  configuration,
  disabled,
  image,
  IMAGES,
  style,
}: Props) {
  const [tag, setTag] = useState<string | undefined>(configuration.tag);
  const [tag_filesystem, set_tag_filesystem] = useState<string | undefined>(
    configuration.tag_filesystem,
  );
  const [tag_cocalc, set_tag_cocalc] = useState<string | undefined>(
    configuration.tag_cocalc,
  );

  useEffect(() => {
    setTag(configuration.tag);
  }, [configuration.tag]);

  useEffect(() => {
    set_tag_filesystem(configuration.tag_filesystem);
  }, [configuration.tag_filesystem]);

  useEffect(() => {
    set_tag_cocalc(configuration.tag_cocalc);
  }, [configuration.tag_cocalc]);

  // [ ] TODO: MAYBE we should allow gpu/non-gpu options in all cases, but just suggest one or the other?
  const options = useMemo(() => {
    const { versions } = IMAGES[image] ?? {};
    if (!versions) {
      return [];
    }
    return versions.map(toOption);
  }, [IMAGES, image]);

  // TODO: it would be better to have tagUrl or something like that below...

  return (
    <div style={style}>
      <SelectTag
        style={{ marginBottom: "5px" }}
        label={
          <A
            href={
              IMAGES[image]?.url ??
              IMAGES[image]?.source ??
              "https://github.com/sagemathinc/cocalc-compute-docker"
            }
          >
            {IMAGES[image]?.label ?? image}
          </A>
        }
        disabled={disabled}
        tag={tag}
        options={options}
        setTag={(tag) => {
          setTag(tag);
          setConfig({ tag });
        }}
      />
      <SelectTag
        style={{ marginBottom: "5px" }}
        label={
          <A
            href={
              IMAGES["filesystem"]?.url ??
              IMAGES["filesystem"]?.source ??
              "https://github.com/sagemathinc/cocalc-compute-docker/tree/main/src/filesystem"
            }
          >
            Filesystem
          </A>
        }
        disabled={disabled}
        tag={tag_filesystem}
        options={(IMAGES["filesystem"]?.versions ?? []).map(toOption)}
        setTag={(tag) => {
          set_tag_filesystem(tag);
          setConfig({ tag_filesystem: tag });
        }}
      />
      <SelectTag
        style={undefined}
        label={
          <A
            href={
              IMAGES["cocalc"]?.url ??
              IMAGES["cocalc"]?.source ??
              "https://www.npmjs.com/package/@cocalc/compute-server"
            }
          >
            CoCalc
          </A>
        }
        disabled={disabled}
        tag={tag_cocalc}
        options={(
          IMAGES["cocalc"]?.versions ?? [{ tag: "test" }, { tag: "latest" }]
        ).map(toOption)}
        setTag={(tag) => {
          set_tag_cocalc(tag);
          setConfig({ tag_cocalc: tag });
        }}
      />
    </div>
  );
}

function toOption(x: { label?: string; tag: string; tested?: boolean }) {
  return {
    label: `${x.label ?? x.tag}${!x.tested ? " (untested)" : ""}`,
    value: x.tag,
    key: x.tag,
  };
}

function SelectTag({ disabled, tag, setTag, options, label, style }) {
  return (
    <div style={{ display: "flex", ...style }}>
      <div
        style={{
          width: "100px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}{" "}
      </div>
      <Radio.Group
        size="small"
        disabled={disabled}
        options={options}
        onChange={({ target: { value } }) => setTag(value)}
        value={tag}
        optionType="button"
        buttonStyle="solid"
      />
    </div>
  );
}
