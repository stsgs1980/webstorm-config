import type { ReactElement } from "react";

interface Props {
  title: string;
}

/**
 * ${NAME} component.
 *
 * @returns JSX element
 */
export const ${NAME} = ({ title }: Props): ReactElement => {
  return <div>{title}</div>;
};

export default ${NAME};
