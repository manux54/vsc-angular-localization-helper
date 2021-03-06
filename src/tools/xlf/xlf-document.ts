import { XmlNode, XmlParser, XmlBuilder } from '..';
import { workspace } from 'vscode';

export class XlfDocument {
  public get valid(): boolean {
    return (
      !!this.root && (this.version === '1.2' || this.version === '2.0') && !!this.sourceLanguage
    );
  }

  public get version(): string | undefined {
    return this.root && this.root.attributes && this.root.attributes['version'];
  }

  public get sourceLanguage(): string | undefined {
    switch (this.version) {
      case '1.2':
        const fileNode = this.root && this.getNode('file', this.root);
        return fileNode && fileNode.attributes && fileNode.attributes['source-language'];

      case '2.0':
        return this.root && this.root.attributes && this.root.attributes['srcLang'];

      default:
        return undefined;
    }
  }

  public set sourceLanguage(lng: string | undefined) {
    switch (this.version) {
      case '1.2':
        const fileNode = this.root && this.getNode('file', this.root);
        if (fileNode && lng) {
          fileNode.attributes['source-language'] = lng;
        }
        break;
      case '2.0':
        if (this.root && lng) {
          this.root.attributes['srcLang'] = lng;
        }
        break;
      default:
        break;
    }
  }

  public get targetLanguage(): string | undefined {
    switch (this.version) {
      case '1.2':
        const fileNode = this.root && this.getNode('file', this.root);
        return fileNode && fileNode.attributes && fileNode.attributes['target-language'];

      case '2.0':
        return this.root && this.root.attributes && this.root.attributes['trgLang'];

      default:
        return undefined;
    }
  }

  public set targetLanguage(lng: string | undefined) {
    switch (this.version) {
      case '1.2':
        const fileNode = this.root && this.getNode('file', this.root);
        if (fileNode && lng) {
          fileNode.attributes['target-language'] = lng;
        }
        break;
      case '2.0':
        if (this.root && lng) {
          this.root.attributes['trgLang'] = lng;
        }
        break;
      default:
        break;
    }
  }

  public get translationUnitNodes(): XmlNode[] {
    if (!this.root) {
      return [];
    }

    switch (this.version) {
      case '1.2':
        const bodyNode = this.getNode('body', this.root);
        if (bodyNode) {
          return <XmlNode[]>bodyNode.children.filter(
            (node) => typeof node !== 'string' && node.name === 'trans-unit',
          );
        } else {
          return [];
        }
      case '2.0':
        const fileNode = this.getNode('file', this.root);
        if (fileNode) {
          return <XmlNode[]>fileNode.children.filter(
            (node) => typeof node !== 'string' && node.name === 'unit',
          );
        } else {
          return [];
        }
      default:
        return [];
    }
  }

  private root: XmlNode | undefined;

  private constructor() {}

  public static async load(source: string): Promise<XlfDocument> {
    const doc = new XlfDocument();
    doc.root = await new XmlParser().parseDocument(source);
    return doc;
  }

  public static create(version: '1.2' | '2.0', language: string): XlfDocument {
    const doc = new XlfDocument();

    doc.root = {
      local: 'xliff',
      attributes: {
        version,
      },
      children: [],
      isSelfClosing: false,
      name: 'xliff',
      parent: undefined,
      prefix: '',
      uri: '',
    };

    if (version === '1.2') {
      doc.root.children.push({
        local: 'file',
        attributes: {
          'target-language': language,
        },
        children: [],
        isSelfClosing: false,
        name: 'file',
        parent: doc.root,
        prefix: '',
        uri: '',
      });
    } else {
      doc.root.attributes['trgLang'] = language;
    }

    return doc;
  }

  public extract(): string | undefined {
    let retVal: string | undefined;

    if (this.valid) {
      retVal = XmlBuilder.create(this.root)!;

      const rootIdx = retVal.indexOf('<xliff ');

      if (rootIdx > 0) {
        retVal = [retVal.slice(0, rootIdx), '\n', retVal.slice(rootIdx)].join('');
      }
    }

    return retVal;
  }

  public findTranslationUnit(id: string): XmlNode | undefined {
    return this.translationUnitNodes.find((node) => node.attributes.id === id);
  }

  public findTranslationUnitByMeaningAndSource(
    meaning: string,
    source: string,
  ): XmlNode | undefined {
    return this.translationUnitNodes.find(
      (node) => this.getUnitMeaning(node) === meaning && this.getUnitSource(node) === source,
    );
  }

  public findTranslationUnitByMeaning(meaning: string): XmlNode | undefined {
    return this.translationUnitNodes.find((node) => this.getUnitMeaning(node) === meaning);
  }

  public findTranslationUnitByMeaningAndDescription(
    meaning: string,
    description: string,
  ): XmlNode | undefined {
    return this.translationUnitNodes.find(
      (node) =>
        this.getUnitMeaning(node) === meaning && this.getUnitDescription(node) === description,
    );
  }

  public getUnitSource(unitNode: XmlNode): string | undefined {
    const sourceNode = this.getNode('source', unitNode);
    if (sourceNode) {
      return XmlBuilder.create(sourceNode);
    } else {
      return undefined;
    }
  }

  public getUnitMeaning(unitNode: XmlNode): string | undefined {
    let meaningNode: XmlNode | undefined;

    switch (this.version) {
      case '1.2':
        meaningNode = <XmlNode | undefined>unitNode.children.find(
          (node) =>
            typeof node !== 'string' && node.name === 'note' && node.attributes.from === 'meaning',
        );
        break;

      case '2.0':
        const notesNode = this.getNode('notes', unitNode);
        if (notesNode) {
          meaningNode = <XmlNode | undefined>notesNode.children.find(
            (node) =>
              typeof node !== 'string' &&
              node.name === 'note' &&
              node.attributes.category === 'meaning',
          );
        }
        break;

      default:
        break;
    }
    if (
      meaningNode &&
      meaningNode.children &&
      meaningNode.children.length &&
      typeof meaningNode.children[0] === 'string'
    ) {
      return <string>meaningNode.children[0];
    }

    return undefined;
  }

  public getUnitDescription(unitNode: XmlNode): string | undefined {
    let descriptionNode: XmlNode | undefined;

    switch (this.version) {
      case '1.2':
        descriptionNode = <XmlNode | undefined>unitNode.children.find(
          (node) =>
            typeof node !== 'string' &&
            node.name === 'note' &&
            node.attributes.from === 'description',
        );
        break;

      case '2.0':
        const notesNode = this.getNode('notes', unitNode);
        if (notesNode) {
          descriptionNode = <XmlNode | undefined>notesNode.children.find(
            (node) =>
              typeof node !== 'string' &&
              node.name === 'note' &&
              node.attributes.category === 'description',
          );
        }
        break;

      default:
        break;
    }

    if (
      descriptionNode &&
      descriptionNode.children &&
      descriptionNode.children.length &&
      typeof descriptionNode.children[0] === 'string'
    ) {
      return <string>descriptionNode.children[0];
    }

    return undefined;
  }

  public mergeUnit(sourceUnit: XmlNode, targetUnit: XmlNode | undefined): void {
    let targetNode: XmlNode | undefined;

    // TODO: Fetch from options
    const preserveTargetOrder = true;

    if (targetUnit) {
      if (preserveTargetOrder) {
        const sourceAttributes = sourceUnit.attributes;
        sourceUnit.attributes = targetUnit.attributes;
        sourceUnit.attributes['id'] = sourceAttributes['id'];
        for (const attr in sourceAttributes) {
          if (!sourceUnit.attributes[attr]) {
            sourceUnit.attributes[attr] = sourceAttributes[attr];
          }
        }
      } else {
        for (const attr in targetUnit.attributes) {
          if (attr !== 'id') {
            sourceUnit.attributes[attr] = targetUnit.attributes[attr];
          }
        }
      }

      targetNode = this.getNode('target', targetUnit);
    }

    if (!targetNode) {
      const missingTranslation: string = workspace.getConfiguration('i18nSync')[
        'missingTranslation'
      ];

      targetNode = {
        name: 'target',
        local: 'target',
        parent: sourceUnit,
        attributes: {},
        children: [missingTranslation],
        isSelfClosing: false,
        prefix: '',
        uri: '',
      };
    }

    if (targetNode) {
      this.appendTargetNode(sourceUnit, targetNode);
    }
  }

  public appendTargetNode(unit: XmlNode, targetNode: XmlNode): void {
    let sourceIdx: number;
    let targetIdx: number;

    switch (this.version) {
      case '1.2':
        sourceIdx = unit.children.findIndex(
          (child) => typeof child !== 'string' && child.name === 'source',
        );
        targetIdx = unit.children.findIndex(
          (child) => typeof child !== 'string' && child.name === 'target',
        );

        if (targetIdx >= 0) {
          unit.children[targetIdx] = targetNode;
        } else if (sourceIdx) {
          unit.children.splice(sourceIdx + 1, 0, unit.children[sourceIdx - 1], targetNode);
        } else {
          unit.children.push(targetNode);
        }
        break;
      case '2.0':
        const segmentNode = this.getNode('segment', unit);
        if (segmentNode) {
          targetNode.parent = segmentNode;
          sourceIdx = segmentNode.children.findIndex(
            (node) => typeof node !== 'string' && node.name === 'source',
          );
          targetIdx = segmentNode.children.findIndex(
            (node) => typeof node !== 'string' && node.name === 'target',
          );

          if (targetIdx >= 0) {
            segmentNode.children[targetIdx] = targetNode;
          } else if (sourceIdx) {
            segmentNode.children.splice(
              sourceIdx + 1,
              0,
              segmentNode.children[sourceIdx - 1],
              targetNode,
            );
          } else {
            segmentNode.children.push(targetNode);
          }
        }
        break;
      default:
        break;
    }
  }

  private getNode(tag: string, node: XmlNode): XmlNode | undefined {
    if (node) {
      if (node.name === tag) {
        return node;
      } else {
        for (const child of node.children) {
          if (typeof child !== 'string') {
            const reqNode = this.getNode(tag, child);
            if (reqNode) {
              return reqNode;
            }
          }
        }
      }
    }

    return undefined;
  }
}
