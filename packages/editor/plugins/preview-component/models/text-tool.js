import ObservableObject from 'common/object/observable';
import Node from 'common/node';

class TextTool extends ObservableObject {

  constructor(properties) {
    super({ cursor: 'text', ...properties });
  }

  notify(message) {

    var node = Node.create({
      label: 'label', type: 'component', componentType: 'text', icon: 'text', value: 'okay',
      attributes: {
        style: {
          position: 'absolute',
          left: message.x,

          // offset cursor height
          top: message.y - 12
        }
      }
    });

    this.app.currentSymbol.children.push(node);

    // focus on the new item - this will trigger the text input
    this.app.setFocus(node);
  }
}

export default TextTool;
