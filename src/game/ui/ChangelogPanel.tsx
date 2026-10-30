import { Fragment, useEffect, useState } from "react";

import "./ChangelogPanel.css";
import { CHANGELOG, parseChangelog } from "./changelog";
import { renderBold } from "./renderBold";

type Props = {
    onClose: () => void;
};

// What's changed, version by version, from docs/CHANGELOG.md. Unreleased only
// shows once something's under it.
export function ChangelogPanel({ onClose }: Props): JSX.Element {
    const [clData, setClData] = useState(CHANGELOG);
    useEffect(() => {
        let mounted = true;
        fetch("docs/CHANGELOG.md", { cache: "no-cache" })
            .then((r) => (r.ok ? r.text() : null))
            .then((txt) => {
                if (mounted && txt) {
                    const parsed = parseChangelog(txt);
                    if (parsed.length > 0) {
                        setClData(parsed);
                    }
                }
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, []);
    return (
        <div className="ui-panel rs-border rs-background ui-changelog">
            <h2>What's new</h2>
            <div className="ui-changelog-list">
                {clData.filter((v) => v.sections.length > 0).map((v) => (
                    <section key={v.version}>
                        <h3 className="ui-changelog-version">
                            {v.version}
                            {v.date && (
                                <span className="ui-changelog-date">{formatDate(v.date)}</span>
                            )}
                        </h3>
                        {v.sections.map((section) => (
                            <Fragment key={section.heading}>
                                <h4 className="ui-changelog-heading">{section.heading}</h4>
                                <ul>
                                    {section.items.map((item, i) => (
                                        <li key={i}>{renderBold(item)}</li>
                                    ))}
                                </ul>
                            </Fragment>
                        ))}
                    </section>
                ))}
            </div>
            <div className="ui-row">
                <button className="ui-button" onClick={onClose}>
                    Back
                </button>
            </div>
        </div>
    );
}

// "2026-10-27" as "27 October 2026"
function formatDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}
